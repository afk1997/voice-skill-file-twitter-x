# User Profiles And Auth Design

Date: 2026-04-30
Status: approved direction, pending implementation plan

## Purpose

Add real app authentication and user profiles so Spool can move from a single shared workspace to user-owned brand workspaces.

This is separate from the existing Codex Local login. Codex Local login lets a signed-in app user connect a local ChatGPT/Codex provider for generation. App auth controls who can enter Spool, which brand workspaces they can see, and which records they can mutate.

## Chosen Approach

Use Clerk for authentication and sessions, plus local Prisma tables for app profiles and ownership.

Why this approach:

- Clerk handles sign-in, sign-up, session cookies, hosted account security, and user menu behavior.
- The app keeps local `UserProfile` and membership records so brand access is enforced inside queries, APIs, and future sharing features.
- The implementation stays small enough for this codebase: no password storage, reset emails, token rotation, or custom session cryptography.

Rejected alternatives:

- Protect-only auth: faster, but it would not solve workspace ownership because all signed-in users would still see the same brands.
- Fully custom auth: possible, but it adds security surface that does not help the product right now.

## Goals

- Add sign-in and sign-up pages.
- Require a signed-in user for app pages and app APIs.
- Create or update a local profile for the current Clerk user.
- Add a profile page where users can edit app-local profile fields.
- Make brand workspaces user-owned.
- Keep existing local data usable by assigning legacy brands to the first signed-in user through a controlled claim flow.
- Keep Codex Local provider login available inside Settings for signed-in users.

## Non-Goals

- Do not build custom password auth.
- Do not build billing, teams, invitations, or organization management in this version.
- Do not expose admin impersonation or role management.
- Do not encrypt provider keys in user profiles. Browser-supplied provider settings continue to live in browser storage, and server providers continue to use environment variables.
- Do not migrate Codex Local account state into the database.

## Current Context

The app currently has no app-user model. Data is centered on `Brand`, and related records hang from brands:

- uploads
- content samples
- voice reports
- skill files
- generations
- rules bank selections and applications

There are Codex Local login endpoints under `/api/codex/*`, but those are provider-login endpoints, not app-auth endpoints. They should remain available after app auth, but only to signed-in app users.

## User Model

Add `UserProfile`:

- `id`
- `clerkUserId`, unique
- `email`
- `displayName`
- `imageUrl`
- `bio`
- `defaultBrandId`, nullable
- `createdAt`
- `updatedAt`

The profile is created lazily through an `ensureCurrentUserProfile` helper. Server pages and API routes can call this helper when they need the current app user. The helper reads Clerk's authenticated user, rejects anonymous requests, and upserts the local profile.

## Workspace Ownership

Add `BrandMembership`:

- `id`
- `brandId`
- `userProfileId`
- `role`: `owner`
- `createdAt`
- `updatedAt`
- unique index on `brandId` and `userProfileId`

The first version only needs `owner`, but using a membership table avoids painting the schema into a corner. Sharing and teams can later add `editor` or `viewer` without rewriting every brand relation.

Brand queries must be scoped through membership:

- list only brands where the current user has membership
- create brand and owner membership in one transaction
- read/update brand only if membership exists
- upload, analyze, generate, feedback, Skill File, and rules endpoints must check membership before touching brand-owned data

Global starter rules remain global. Custom global rules should become per-user global rules by attaching them to `UserProfile`, so one user's reusable custom rules do not leak into another user's account. Brand-scoped custom rules remain tied to the brand and therefore inherit brand membership checks.

## Legacy Data Claiming

Existing databases may already have brands with no memberships. The first signed-in user should be able to claim legacy brands through a deliberate flow:

- home page detects unowned brands only for signed-in users
- shows a compact "Claim existing workspaces" panel
- claim action creates owner memberships for all unowned brands in one transaction
- after any brand has a membership, anonymous access is still blocked and unrelated signed-in users cannot see that brand

This keeps the local development data usable without silently assigning production data to the wrong account.

## Routes And UI

Add auth routes:

- `/sign-in/[[...sign-in]]`
- `/sign-up/[[...sign-up]]`

Add profile route:

- `/profile`

Update the app shell:

- wrap the app in `ClerkProvider`
- show user menu or sign-in button in the header
- keep Provider Settings and New brand links for signed-in users
- add a Profile link or profile entry through the user menu

Update `/`:

- signed-out users see a focused sign-in prompt, not workspace data
- signed-in users see only their brand workspaces
- signed-in users with unowned legacy data can claim it

Update `/brands/new`:

- creating a brand also creates owner membership

Update brand pages and brand APIs:

- require membership before reading or writing brand data
- return 404 for unauthorized brand ids to avoid exposing whether another user's brand exists

## API

Add profile endpoints:

- `GET /api/profile`: returns the current local profile
- `PATCH /api/profile`: updates app-local fields such as display name and bio

Add legacy claim endpoint:

- `POST /api/profile/claim-legacy-brands`: claims unowned brands for the current user

Protect existing app APIs with a shared helper:

- brand collection routes use current profile
- brand-specific routes require `assertBrandAccess`
- global rules route lists starter rules plus custom rules owned by the current profile
- global custom rule creation stores `userProfileId`

The provider status endpoint can remain public enough to report configured server provider availability, but mutation endpoints and Codex Local endpoints should require app auth.

## Data Flow

Sign in:

1. Clerk authenticates the browser.
2. App server page calls `ensureCurrentUserProfile`.
3. Local profile is upserted from Clerk user data.
4. Home page loads memberships and brand workspaces for that profile.

Create brand:

1. User submits brand form.
2. API gets current profile.
3. Transaction creates `Brand` and `BrandMembership`.
4. User is redirected to the new brand workspace.

Read brand:

1. Page or API receives `brandId`.
2. `assertBrandAccess` checks membership.
3. If missing, return not found or 404 JSON.
4. If present, continue existing brand logic.

Custom global rule:

1. User creates a global custom rule.
2. Rule stores `scope: global`, `source: custom`, and `userProfileId`.
3. Rule list returns starter rules plus custom rules for that profile.

## Error Handling

- Anonymous page requests redirect to `/sign-in`.
- Anonymous API requests return `401`.
- Signed-in users without brand membership get `404` for brand-scoped data.
- Missing Clerk environment variables should produce a clear setup error during local development.
- Profile update validation should reject empty display names when the user is trying to set one.

## Testing

Unit tests:

- profile upsert creates and updates a local profile from Clerk user data
- brand creation creates owner membership
- brand access helper allows owners and rejects non-members
- list brand workspaces only returns brands for the current profile
- global custom rules do not leak between users
- legacy claim creates owner memberships only for unowned brands

Route tests:

- anonymous profile request returns `401`
- profile patch updates local fields
- unauthorized brand route returns `404`
- brand creation associates membership

Component tests:

- signed-in header renders user actions
- signed-out home renders sign-in prompt
- profile form submits changed fields
- legacy claim panel appears only when there are unowned brands

Live verification:

- install Clerk SDK and set required local env vars
- sign in through Clerk
- create profile
- create brand
- confirm only signed-in user's brands appear
- claim existing local workspaces when needed
- run Skill File, Rules Bank, and Studio flows while signed in

## Migration Notes

The migration adds user tables and optional `RuleBankRule.userProfileId`.

Existing brands remain in place with no membership until claimed. This avoids assigning data to the wrong user during migration. If this app is deployed with real shared data, the operator should sign in as the intended owner and use the claim flow immediately after deployment.

## Open Operational Requirement

Before implementation can be verified end to end, Clerk credentials must be available in the environment:

- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
- `CLERK_SECRET_KEY`
- `NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in`
- `NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up`

Without those values, code can be typechecked and unit-tested, but browser sign-in cannot be completed locally.
