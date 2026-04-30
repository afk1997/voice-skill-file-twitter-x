# User Profiles And Auth Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Clerk-backed authentication, local user profiles, and user-owned brand workspaces.

**Architecture:** Clerk owns authentication and session cookies. Spool owns app-local `UserProfile` records, `BrandMembership` ownership checks, profile settings, and workspace scoping. All brand-owned pages and APIs must flow through shared auth/access helpers before touching brand data.

**Tech Stack:** Next.js App Router, Clerk `@clerk/nextjs`, Prisma/Postgres, Vitest, React Testing Library.

---

## References

- Clerk `clerkMiddleware()` docs: https://clerk.com/docs/reference/nextjs/clerk-middleware
- Clerk `auth()` docs: https://clerk.com/docs/reference/nextjs/app-router/auth
- Clerk `currentUser()` docs: https://clerk.com/docs/reference/nextjs/app-router/current-user
- Clerk SignIn component docs: https://clerk.com/docs/nextjs/reference/components/authentication/sign-in

Use `middleware.ts`, not `proxy.ts`, because this app is on Next 15.

## Files And Responsibilities

- `package.json`, `package-lock.json`: add `@clerk/nextjs`.
- `middleware.ts`: install Clerk middleware and protect app/API routes.
- `app/layout.tsx`: wrap app in `ClerkProvider` and render signed-in header controls.
- `app/sign-in/[[...sign-in]]/page.tsx`: Clerk sign-in page.
- `app/sign-up/[[...sign-up]]/page.tsx`: Clerk sign-up page.
- `app/profile/page.tsx`: profile page.
- `components/auth/AppHeader.tsx`: signed-in/signed-out navigation and user menu.
- `components/profile/ProfileForm.tsx`: edit local profile fields.
- `components/profile/ClaimLegacyBrandsPanel.tsx`: claim unowned legacy workspaces.
- `lib/auth/currentUserProfile.ts`: Clerk-to-local-profile helpers.
- `lib/auth/brandAccess.ts`: brand membership, creation, listing, and legacy claim helpers.
- `lib/auth/errors.ts`: shared auth/access errors.
- `lib/auth/testDoubles.ts`: small test-only input helpers if needed.
- `lib/brands/listBrandWorkspaces.ts`: scope workspace listing by user profile.
- `lib/rules/ruleBankService.ts`: scope global custom rules by user profile.
- `prisma/schema.prisma`: add profile, membership, and rule owner fields.
- `prisma/migrations/<timestamp>_add_user_profiles_auth/migration.sql`: create auth-related tables.
- Existing brand pages and APIs under `app/brands/**` and `app/api/brands/**`: add `ensureCurrentUserProfile` and `assertBrandAccess`.
- Existing rules APIs under `app/api/rules/**`: add profile scoping for custom global rules.
- `tests/auth/*.test.ts`: profile and access helper coverage.
- `tests/brands/*.test.ts`: scoped workspace and create-brand ownership coverage.
- `tests/rules/*.test.ts`: global custom rule isolation coverage.
- `tests/profile/*.test.tsx`: profile and legacy-claim component coverage.

## Task 1: Install Clerk And Add Schema

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/20260430010000_add_user_profiles_auth/migration.sql`

- [ ] **Step 1: Install Clerk**

Run:

```bash
npm install @clerk/nextjs
```

Expected: `package.json` contains `@clerk/nextjs`, and `package-lock.json` is updated.

- [ ] **Step 2: Update Prisma schema**

Add this enum and models near the existing app models in `prisma/schema.prisma`:

```prisma
enum BrandMembershipRole {
  OWNER @map("owner")
}

model UserProfile {
  id             String   @id @default(cuid())
  clerkUserId    String   @unique
  email          String?
  displayName    String?
  imageUrl       String?
  bio            String?
  defaultBrandId String?
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  memberships BrandMembership[]
  ruleBankRules RuleBankRule[]

  @@index([email])
}

model BrandMembership {
  id            String              @id @default(cuid())
  brandId       String
  brand         Brand               @relation(fields: [brandId], references: [id], onDelete: Cascade)
  userProfileId String
  userProfile   UserProfile         @relation(fields: [userProfileId], references: [id], onDelete: Cascade)
  role          BrandMembershipRole @default(OWNER)
  createdAt     DateTime            @default(now())
  updatedAt     DateTime            @updatedAt

  @@unique([brandId, userProfileId])
  @@index([userProfileId, role])
  @@index([brandId, role])
}
```

Modify `Brand`:

```prisma
  memberships BrandMembership[]
```

Modify `RuleBankRule`:

```prisma
  userProfileId String?
  userProfile   UserProfile? @relation(fields: [userProfileId], references: [id], onDelete: Cascade)

  @@index([userProfileId, scope, source])
```

- [ ] **Step 3: Create migration SQL**

Create `prisma/migrations/20260430010000_add_user_profiles_auth/migration.sql`:

```sql
CREATE TYPE "BrandMembershipRole" AS ENUM ('owner');

CREATE TABLE "UserProfile" (
    "id" TEXT NOT NULL,
    "clerkUserId" TEXT NOT NULL,
    "email" TEXT,
    "displayName" TEXT,
    "imageUrl" TEXT,
    "bio" TEXT,
    "defaultBrandId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "UserProfile_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BrandMembership" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "userProfileId" TEXT NOT NULL,
    "role" "BrandMembershipRole" NOT NULL DEFAULT 'owner',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "BrandMembership_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "RuleBankRule" ADD COLUMN "userProfileId" TEXT;

CREATE UNIQUE INDEX "UserProfile_clerkUserId_key" ON "UserProfile"("clerkUserId");
CREATE INDEX "UserProfile_email_idx" ON "UserProfile"("email");
CREATE UNIQUE INDEX "BrandMembership_brandId_userProfileId_key" ON "BrandMembership"("brandId", "userProfileId");
CREATE INDEX "BrandMembership_userProfileId_role_idx" ON "BrandMembership"("userProfileId", "role");
CREATE INDEX "BrandMembership_brandId_role_idx" ON "BrandMembership"("brandId", "role");
CREATE INDEX "RuleBankRule_userProfileId_scope_source_idx" ON "RuleBankRule"("userProfileId", "scope", "source");

ALTER TABLE "BrandMembership" ADD CONSTRAINT "BrandMembership_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BrandMembership" ADD CONSTRAINT "BrandMembership_userProfileId_fkey" FOREIGN KEY ("userProfileId") REFERENCES "UserProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RuleBankRule" ADD CONSTRAINT "RuleBankRule_userProfileId_fkey" FOREIGN KEY ("userProfileId") REFERENCES "UserProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
```

- [ ] **Step 4: Validate schema**

Run:

```bash
DATABASE_URL='postgresql://user:pass@localhost:5432/db' DIRECT_URL='postgresql://user:pass@localhost:5432/db' npx prisma validate
DATABASE_URL='postgresql://user:pass@localhost:5432/db' DIRECT_URL='postgresql://user:pass@localhost:5432/db' npx prisma generate
```

Expected: both commands exit 0.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json prisma/schema.prisma prisma/migrations/20260430010000_add_user_profiles_auth/migration.sql
git commit -m "feat: add auth profile schema"
```

## Task 2: Build Profile Auth Helpers

**Files:**
- Create: `lib/auth/errors.ts`
- Create: `lib/auth/currentUserProfile.ts`
- Test: `tests/auth/currentUserProfile.test.ts`

- [ ] **Step 1: Write failing tests**

Create `tests/auth/currentUserProfile.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import { AuthRequiredError } from "@/lib/auth/errors";
import { ensureCurrentUserProfileFromSources, serializeProfile } from "@/lib/auth/currentUserProfile";

describe("currentUserProfile", () => {
  it("rejects anonymous users", async () => {
    await expect(
      ensureCurrentUserProfileFromSources({
        prisma: {} as never,
        readAuth: async () => ({ userId: null }),
        readCurrentUser: async () => null,
      }),
    ).rejects.toBeInstanceOf(AuthRequiredError);
  });

  it("upserts a local profile from Clerk user data", async () => {
    const upsert = vi.fn().mockResolvedValue({
      id: "profile1",
      clerkUserId: "user_123",
      email: "kaivan@example.com",
      displayName: "Kaivan",
      imageUrl: "https://img.example/avatar.png",
      bio: null,
      defaultBrandId: null,
    });

    const profile = await ensureCurrentUserProfileFromSources({
      prisma: { userProfile: { upsert } },
      readAuth: async () => ({ userId: "user_123" }),
      readCurrentUser: async () => ({
        id: "user_123",
        fullName: "Kaivan",
        imageUrl: "https://img.example/avatar.png",
        primaryEmailAddress: { emailAddress: "kaivan@example.com" },
      }),
    } as never);

    expect(upsert).toHaveBeenCalledWith({
      where: { clerkUserId: "user_123" },
      update: {
        email: "kaivan@example.com",
        displayName: "Kaivan",
        imageUrl: "https://img.example/avatar.png",
      },
      create: {
        clerkUserId: "user_123",
        email: "kaivan@example.com",
        displayName: "Kaivan",
        imageUrl: "https://img.example/avatar.png",
      },
    });
    expect(profile.id).toBe("profile1");
  });

  it("serializes profile dates and nullable fields for JSON responses", () => {
    expect(
      serializeProfile({
        id: "profile1",
        clerkUserId: "user_123",
        email: "kaivan@example.com",
        displayName: null,
        imageUrl: null,
        bio: null,
        defaultBrandId: null,
        createdAt: new Date("2026-04-30T00:00:00.000Z"),
        updatedAt: new Date("2026-04-30T00:00:01.000Z"),
      }),
    ).toMatchObject({
      id: "profile1",
      email: "kaivan@example.com",
      displayName: "",
      bio: "",
      createdAt: "2026-04-30T00:00:00.000Z",
    });
  });
});
```

- [ ] **Step 2: Run tests to verify RED**

Run:

```bash
npm test -- tests/auth/currentUserProfile.test.ts
```

Expected: FAIL because `@/lib/auth/currentUserProfile` does not exist.

- [ ] **Step 3: Implement auth errors**

Create `lib/auth/errors.ts`:

```ts
export class AuthRequiredError extends Error {
  constructor(message = "Sign in is required.") {
    super(message);
    this.name = "AuthRequiredError";
  }
}

export class BrandAccessError extends Error {
  constructor(message = "Brand not found.") {
    super(message);
    this.name = "BrandAccessError";
  }
}

export function authErrorStatus(error: unknown) {
  if (error instanceof AuthRequiredError) return 401;
  if (error instanceof BrandAccessError) return 404;
  return 500;
}
```

- [ ] **Step 4: Implement profile helper**

Create `lib/auth/currentUserProfile.ts`:

```ts
import { auth, currentUser } from "@clerk/nextjs/server";
import type { UserProfile } from "@prisma/client";
import { prisma } from "@/lib/db";
import { AuthRequiredError } from "@/lib/auth/errors";

type PrismaLike = Record<string, any>;

type AuthResult = {
  userId: string | null;
};

type ClerkUserLike = {
  id: string;
  fullName?: string | null;
  imageUrl?: string | null;
  primaryEmailAddress?: { emailAddress?: string | null } | null;
};

function profileFieldsFromUser(userId: string, user: ClerkUserLike | null) {
  return {
    clerkUserId: userId,
    email: user?.primaryEmailAddress?.emailAddress ?? null,
    displayName: user?.fullName ?? null,
    imageUrl: user?.imageUrl ?? null,
  };
}

export async function ensureCurrentUserProfileFromSources({
  prisma: client,
  readAuth,
  readCurrentUser,
}: {
  prisma: PrismaLike;
  readAuth: () => Promise<AuthResult>;
  readCurrentUser: () => Promise<ClerkUserLike | null>;
}) {
  const session = await readAuth();
  if (!session.userId) throw new AuthRequiredError();

  const user = await readCurrentUser();
  const fields = profileFieldsFromUser(session.userId, user);

  return client.userProfile.upsert({
    where: { clerkUserId: session.userId },
    update: {
      email: fields.email,
      displayName: fields.displayName,
      imageUrl: fields.imageUrl,
    },
    create: fields,
  });
}

export async function ensureCurrentUserProfile() {
  return ensureCurrentUserProfileFromSources({
    prisma,
    readAuth: async () => {
      const session = await auth();
      return { userId: session.userId };
    },
    readCurrentUser: currentUser,
  });
}

export async function currentUserProfileOrNull() {
  try {
    return await ensureCurrentUserProfile();
  } catch (error) {
    if (error instanceof AuthRequiredError) return null;
    throw error;
  }
}

export function serializeProfile(profile: UserProfile) {
  return {
    id: profile.id,
    clerkUserId: profile.clerkUserId,
    email: profile.email ?? "",
    displayName: profile.displayName ?? "",
    imageUrl: profile.imageUrl ?? "",
    bio: profile.bio ?? "",
    defaultBrandId: profile.defaultBrandId ?? "",
    createdAt: profile.createdAt.toISOString(),
    updatedAt: profile.updatedAt.toISOString(),
  };
}
```

- [ ] **Step 5: Run tests to verify GREEN**

Run:

```bash
npm test -- tests/auth/currentUserProfile.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add lib/auth/errors.ts lib/auth/currentUserProfile.ts tests/auth/currentUserProfile.test.ts
git commit -m "feat: add current user profile helpers"
```

## Task 3: Add Brand Ownership Helpers

**Files:**
- Create: `lib/auth/brandAccess.ts`
- Modify: `lib/brands/listBrandWorkspaces.ts`
- Test: `tests/auth/brandAccess.test.ts`
- Test: `tests/brands/listBrandWorkspaces.test.ts`

- [ ] **Step 1: Write failing brand access tests**

Create `tests/auth/brandAccess.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import { BrandAccessError } from "@/lib/auth/errors";
import { assertBrandAccess, claimLegacyBrands, createBrandForProfile } from "@/lib/auth/brandAccess";

describe("brandAccess", () => {
  it("allows members to access a brand", async () => {
    const membership = { id: "membership1", brandId: "brand1", userProfileId: "profile1", role: "OWNER" };
    const result = await assertBrandAccess({
      prisma: { brandMembership: { findUnique: vi.fn().mockResolvedValue(membership) } },
      profileId: "profile1",
      brandId: "brand1",
    });

    expect(result).toBe(membership);
  });

  it("rejects non-members with a not-found style error", async () => {
    await expect(
      assertBrandAccess({
        prisma: { brandMembership: { findUnique: vi.fn().mockResolvedValue(null) } },
        profileId: "profile2",
        brandId: "brand1",
      }),
    ).rejects.toBeInstanceOf(BrandAccessError);
  });

  it("creates a brand and owner membership in one transaction", async () => {
    const createBrand = vi.fn().mockResolvedValue({ id: "brand1", name: "Acme" });
    const createMembership = vi.fn().mockResolvedValue({ id: "membership1" });
    const transaction = vi.fn((callback) =>
      callback({
        brand: { create: createBrand },
        brandMembership: { create: createMembership },
      }),
    );

    const brand = await createBrandForProfile({
      prisma: { $transaction: transaction },
      profileId: "profile1",
      input: { name: "Acme" },
    } as never);

    expect(brand.id).toBe("brand1");
    expect(createMembership).toHaveBeenCalledWith({
      data: { brandId: "brand1", userProfileId: "profile1", role: "OWNER" },
    });
  });

  it("claims only brands without memberships", async () => {
    const createMany = vi.fn().mockResolvedValue({ count: 2 });
    const result = await claimLegacyBrands({
      prisma: {
        brand: { findMany: vi.fn().mockResolvedValue([{ id: "brand1" }, { id: "brand2" }]) },
        brandMembership: { createMany },
      },
      profileId: "profile1",
    });

    expect(createMany).toHaveBeenCalledWith({
      data: [
        { brandId: "brand1", userProfileId: "profile1", role: "OWNER" },
        { brandId: "brand2", userProfileId: "profile1", role: "OWNER" },
      ],
      skipDuplicates: true,
    });
    expect(result.claimedCount).toBe(2);
  });
});
```

- [ ] **Step 2: Run tests to verify RED**

```bash
npm test -- tests/auth/brandAccess.test.ts
```

Expected: FAIL because `@/lib/auth/brandAccess` does not exist.

- [ ] **Step 3: Implement brand access helpers**

Create `lib/auth/brandAccess.ts`:

```ts
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { BrandAccessError } from "@/lib/auth/errors";

type PrismaLike = Record<string, any>;

export async function assertBrandAccess({ prisma: client = prisma, profileId, brandId }: { prisma?: PrismaLike; profileId: string; brandId: string }) {
  const membership = await client.brandMembership.findUnique({
    where: { brandId_userProfileId: { brandId, userProfileId: profileId } },
  });
  if (!membership) throw new BrandAccessError();
  return membership;
}

export async function createBrandForProfile({
  prisma: client = prisma,
  profileId,
  input,
}: {
  prisma?: PrismaLike;
  profileId: string;
  input: Prisma.BrandCreateInput;
}) {
  return client.$transaction(async (tx: PrismaLike) => {
    const brand = await tx.brand.create({ data: input });
    await tx.brandMembership.create({
      data: { brandId: brand.id, userProfileId: profileId, role: "OWNER" },
    });
    return brand;
  });
}

export async function findUnownedBrands({ prisma: client = prisma }: { prisma?: PrismaLike } = {}) {
  return client.brand.findMany({
    where: { memberships: { none: {} } },
    orderBy: { updatedAt: "desc" },
    select: { id: true, name: true, twitterHandle: true, category: true },
  });
}

export async function claimLegacyBrands({ prisma: client = prisma, profileId }: { prisma?: PrismaLike; profileId: string }) {
  const brands = await client.brand.findMany({
    where: { memberships: { none: {} } },
    select: { id: true },
  });
  if (brands.length === 0) return { claimedCount: 0 };

  const result = await client.brandMembership.createMany({
    data: brands.map((brand: { id: string }) => ({ brandId: brand.id, userProfileId: profileId, role: "OWNER" })),
    skipDuplicates: true,
  });
  return { claimedCount: result.count ?? brands.length };
}
```

- [ ] **Step 4: Update workspace listing tests**

Modify `tests/brands/listBrandWorkspaces.test.ts` so it checks scoped loading:

```ts
import { describe, expect, it, vi } from "vitest";
import { listBrandWorkspaces, scopedBrandWorkspaceQuery } from "@/lib/brands/listBrandWorkspaces";

describe("listBrandWorkspaces", () => {
  it("loads only brands owned by the current profile", async () => {
    const findMany = vi.fn().mockResolvedValue([{ id: "brand1", name: "Acme" }]);

    const result = await listBrandWorkspaces("profile1", () => findMany(scopedBrandWorkspaceQuery("profile1")) as never);

    expect(result.brands).toEqual([{ id: "brand1", name: "Acme" }]);
    expect(findMany.mock.calls[0][0].where).toEqual({
      memberships: { some: { userProfileId: "profile1" } },
    });
  });
});
```

- [ ] **Step 5: Update workspace listing implementation**

Modify `lib/brands/listBrandWorkspaces.ts`:

```ts
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

export function scopedBrandWorkspaceQuery(profileId: string) {
  return {
    where: { memberships: { some: { userProfileId: profileId } } },
    orderBy: { updatedAt: "desc" },
    include: {
      _count: { select: { contentSamples: true, skillFiles: true } },
      skillFiles: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  } satisfies Prisma.BrandFindManyArgs;
}

export const brandWorkspaceQuery = scopedBrandWorkspaceQuery;
export type BrandWorkspace = Prisma.BrandGetPayload<ReturnType<typeof scopedBrandWorkspaceQuery>>;

type LoadBrandWorkspaces = (query: ReturnType<typeof scopedBrandWorkspaceQuery>) => Promise<BrandWorkspace[]>;

function loadBrandWorkspaces(query: ReturnType<typeof scopedBrandWorkspaceQuery>) {
  return prisma.brand.findMany(query);
}

export async function listBrandWorkspaces(profileId: string, load: LoadBrandWorkspaces = loadBrandWorkspaces) {
  try {
    return {
      brands: await load(scopedBrandWorkspaceQuery(profileId)),
      loadError: null,
    };
  } catch (error) {
    console.error("Failed to load brand workspaces.", error);
    return {
      brands: [],
      loadError: "Brand workspaces could not be loaded. Check the database connection and try again.",
    };
  }
}
```

- [ ] **Step 6: Run tests to verify GREEN**

```bash
npm test -- tests/auth/brandAccess.test.ts tests/brands/listBrandWorkspaces.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add lib/auth/brandAccess.ts lib/brands/listBrandWorkspaces.ts tests/auth/brandAccess.test.ts tests/brands/listBrandWorkspaces.test.ts
git commit -m "feat: add brand ownership helpers"
```

## Task 4: Add Clerk Shell, Auth Pages, And Middleware

**Files:**
- Create: `middleware.ts`
- Create: `components/auth/AppHeader.tsx`
- Create: `app/sign-in/[[...sign-in]]/page.tsx`
- Create: `app/sign-up/[[...sign-up]]/page.tsx`
- Modify: `app/layout.tsx`
- Modify: `app/page.tsx`
- Test: `tests/auth/appHeader.test.tsx`

- [ ] **Step 1: Write failing header test**

Create `tests/auth/appHeader.test.tsx`:

```tsx
// @vitest-environment jsdom
import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AppHeader } from "@/components/auth/AppHeader";

vi.mock("@clerk/nextjs", () => ({
  SignedIn: ({ children }: { children: React.ReactNode }) => <div data-testid="signed-in">{children}</div>,
  SignedOut: ({ children }: { children: React.ReactNode }) => <div data-testid="signed-out">{children}</div>,
  SignInButton: ({ children }: { children: React.ReactNode }) => <button>{children}</button>,
  SignUpButton: ({ children }: { children: React.ReactNode }) => <button>{children}</button>,
  UserButton: () => <button aria-label="User menu">User</button>,
}));

afterEach(() => cleanup());

describe("AppHeader", () => {
  it("renders navigation for signed-in users and auth actions for signed-out users", () => {
    render(<AppHeader />);

    expect(screen.getByText("Provider Settings")).toBeTruthy();
    expect(screen.getByText("New brand")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Sign in" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Sign up" })).toBeTruthy();
    expect(screen.getByLabelText("User menu")).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify RED**

```bash
npm test -- tests/auth/appHeader.test.tsx
```

Expected: FAIL because `AppHeader` does not exist.

- [ ] **Step 3: Implement AppHeader**

Create `components/auth/AppHeader.tsx`:

```tsx
import Link from "next/link";
import { SignedIn, SignedOut, SignInButton, SignUpButton, UserButton } from "@clerk/nextjs";
import { SpoolWordmark } from "@/components/ui/SpoolWordmark";

export function AppHeader() {
  return (
    <header className="border-b-[1.5px] border-ink bg-paper/95">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-5 py-4 md:flex-row md:items-center md:justify-between md:px-6">
        <Link href="/" aria-label="Spool home">
          <SpoolWordmark className="text-3xl" />
        </Link>
        <nav className="flex flex-wrap items-center gap-2 font-mono text-[10px] font-semibold uppercase tracking-normal text-ink md:gap-3">
          <SignedIn>
            <Link href="/settings" className="hover:text-accentText">
              Provider Settings
            </Link>
            <Link href="/profile" className="hover:text-accentText">
              Profile
            </Link>
            <Link href="/brands/new" className="spool-button min-h-9 px-3 py-2 font-sans text-xs normal-case tracking-normal">
              New brand
            </Link>
            <UserButton afterSignOutUrl="/sign-in" />
          </SignedIn>
          <SignedOut>
            <SignInButton mode="modal">
              <button type="button" className="spool-button-secondary min-h-9 px-3 py-2 font-sans text-xs normal-case tracking-normal">
                Sign in
              </button>
            </SignInButton>
            <SignUpButton mode="modal">
              <button type="button" className="spool-button min-h-9 px-3 py-2 font-sans text-xs normal-case tracking-normal">
                Sign up
              </button>
            </SignUpButton>
          </SignedOut>
        </nav>
      </div>
    </header>
  );
}
```

- [ ] **Step 4: Wrap layout in ClerkProvider**

Modify `app/layout.tsx`:

```tsx
import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { AppHeader } from "@/components/auth/AppHeader";
import "./globals.css";

export const metadata: Metadata = {
  title: "Spool",
  description: "Turn real writing into Skill Files for agent-ready drafts.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider>
      <html lang="en">
        <body>
          <AppHeader />
          <main className="mx-auto max-w-6xl px-5 py-8 md:px-6">{children}</main>
        </body>
      </html>
    </ClerkProvider>
  );
}
```

- [ ] **Step 5: Add middleware**

Create `middleware.ts`:

```ts
import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

const isPublicRoute = createRouteMatcher(["/sign-in(.*)", "/sign-up(.*)"]);

export default clerkMiddleware(async (auth, req) => {
  if (!isPublicRoute(req)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
```

- [ ] **Step 6: Add auth pages**

Create `app/sign-in/[[...sign-in]]/page.tsx`:

```tsx
import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
  return (
    <div className="flex justify-center py-10">
      <SignIn />
    </div>
  );
}
```

Create `app/sign-up/[[...sign-up]]/page.tsx`:

```tsx
import { SignUp } from "@clerk/nextjs";

export default function SignUpPage() {
  return (
    <div className="flex justify-center py-10">
      <SignUp />
    </div>
  );
}
```

- [ ] **Step 7: Update home page to require local profile**

Modify `app/page.tsx` so it calls `ensureCurrentUserProfile`, `findUnownedBrands`, and scoped `listBrandWorkspaces`:

```tsx
import Link from "next/link";
import { ClaimLegacyBrandsPanel } from "@/components/profile/ClaimLegacyBrandsPanel";
import { ensureCurrentUserProfile } from "@/lib/auth/currentUserProfile";
import { findUnownedBrands } from "@/lib/auth/brandAccess";
import { listBrandWorkspaces } from "@/lib/brands/listBrandWorkspaces";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const profile = await ensureCurrentUserProfile();
  const [{ brands, loadError }, unownedBrands] = await Promise.all([listBrandWorkspaces(profile.id), findUnownedBrands()]);

  return (
    <div className="space-y-8">
      <section className="pb-2 pt-6">
        <p className="spool-stamp">Content / voice / agents</p>
        <h1 className="mt-7 max-w-4xl font-display text-5xl font-semibold leading-[0.92] tracking-normal text-ink md:text-7xl">
          Build a reusable voice engine from real writing.
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-7 text-muted">
          Turn real writing into a Skill File your agents can use to draft posts, threads, and replies in the right voice.
        </p>
        <Link href="/brands/new" className="spool-button mt-6">
          Create Brand Voice Workspace
        </Link>
      </section>

      {unownedBrands.length ? <ClaimLegacyBrandsPanel brands={unownedBrands} /> : null}

      <section>
        <h2 className="text-xl font-semibold text-ink">Brand workspaces</h2>
        {loadError ? (
          <p className="mt-2 max-w-xl text-sm text-muted">{loadError}</p>
        ) : brands.length === 0 ? (
          <p className="mt-2 text-sm text-muted">No workspaces yet. Create one to start building a Skill File.</p>
        ) : (
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {brands.map((brand) => (
              <Link key={brand.id} href={`/brands/${brand.id}`} className="spool-plate p-4 transition-colors hover:border-accentText">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-semibold text-ink">{brand.name}</h3>
                    <p className="mt-1 text-sm text-muted">{brand.twitterHandle || brand.category || "Brand voice workspace"}</p>
                  </div>
                  <span className="border-[1.5px] border-ink bg-paper px-2 py-1 font-mono text-[10px] font-semibold uppercase tracking-normal text-muted">
                    {brand.skillFiles[0]?.version || "No skill file"}
                  </span>
                </div>
                <p className="mt-3 text-sm text-muted">
                  {brand._count.contentSamples} samples stored / {brand._count.skillFiles} skill versions
                </p>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
```

- [ ] **Step 8: Run tests**

```bash
npm test -- tests/auth/appHeader.test.tsx
```

Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add middleware.ts app/layout.tsx app/page.tsx app/sign-in app/sign-up components/auth/AppHeader.tsx tests/auth/appHeader.test.tsx
git commit -m "feat: add Clerk app shell"
```

## Task 5: Add Profile And Legacy Claim APIs/UI

**Files:**
- Create: `app/api/profile/route.ts`
- Create: `app/api/profile/claim-legacy-brands/route.ts`
- Create: `app/profile/page.tsx`
- Create: `components/profile/ProfileForm.tsx`
- Create: `components/profile/ClaimLegacyBrandsPanel.tsx`
- Test: `tests/profile/profileRoutes.test.ts`
- Test: `tests/profile/profileComponents.test.tsx`

- [ ] **Step 1: Write failing route tests**

Create `tests/profile/profileRoutes.test.ts` with mocks for `ensureCurrentUserProfile` and `claimLegacyBrands`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const authBridge = vi.hoisted(() => ({
  ensureCurrentUserProfile: vi.fn(),
  serializeProfile: vi.fn((profile) => ({ ...profile, bio: profile.bio ?? "" })),
}));
const accessBridge = vi.hoisted(() => ({
  claimLegacyBrands: vi.fn(),
}));
const dbBridge = vi.hoisted(() => ({
  prisma: { userProfile: { update: vi.fn() } },
}));

vi.mock("@/lib/auth/currentUserProfile", () => authBridge);
vi.mock("@/lib/auth/brandAccess", () => accessBridge);
vi.mock("@/lib/db", () => dbBridge);

describe("profile routes", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns the current profile", async () => {
    authBridge.ensureCurrentUserProfile.mockResolvedValue({ id: "profile1", bio: null });
    const { GET } = await import("@/app/api/profile/route");

    const response = await GET();

    await expect(response.json()).resolves.toMatchObject({ profile: { id: "profile1", bio: "" } });
  });

  it("updates local profile fields", async () => {
    authBridge.ensureCurrentUserProfile.mockResolvedValue({ id: "profile1" });
    dbBridge.prisma.userProfile.update.mockResolvedValue({ id: "profile1", displayName: "Kai", bio: "Builder" });
    const { PATCH } = await import("@/app/api/profile/route");

    const response = await PATCH(new Request("http://localhost/api/profile", { method: "PATCH", body: JSON.stringify({ displayName: "Kai", bio: "Builder" }) }));

    expect(dbBridge.prisma.userProfile.update).toHaveBeenCalledWith({
      where: { id: "profile1" },
      data: { displayName: "Kai", bio: "Builder" },
    });
    await expect(response.json()).resolves.toMatchObject({ profile: { displayName: "Kai" } });
  });

  it("claims legacy brands for the current profile", async () => {
    authBridge.ensureCurrentUserProfile.mockResolvedValue({ id: "profile1" });
    accessBridge.claimLegacyBrands.mockResolvedValue({ claimedCount: 3 });
    const { POST } = await import("@/app/api/profile/claim-legacy-brands/route");

    const response = await POST();

    expect(accessBridge.claimLegacyBrands).toHaveBeenCalledWith({ profileId: "profile1" });
    await expect(response.json()).resolves.toEqual({ claimedCount: 3 });
  });
});
```

- [ ] **Step 2: Run route tests to verify RED**

```bash
npm test -- tests/profile/profileRoutes.test.ts
```

Expected: FAIL because profile routes do not exist.

- [ ] **Step 3: Implement profile routes**

Create `app/api/profile/route.ts`:

```ts
import { prisma } from "@/lib/db";
import { jsonError, jsonErrorFromUnknown, jsonOk } from "@/lib/request";
import { authErrorStatus } from "@/lib/auth/errors";
import { ensureCurrentUserProfile, serializeProfile } from "@/lib/auth/currentUserProfile";

export async function GET() {
  try {
    const profile = await ensureCurrentUserProfile();
    return jsonOk({ profile: serializeProfile(profile) });
  } catch (error) {
    if (error instanceof Error) return jsonError(error.message, authErrorStatus(error));
    return jsonErrorFromUnknown(error, "Could not load profile.", 500);
  }
}

export async function PATCH(request: Request) {
  try {
    const current = await ensureCurrentUserProfile();
    const body = await request.json();
    const displayName = typeof body.displayName === "string" ? body.displayName.trim() : "";
    const bio = typeof body.bio === "string" ? body.bio.trim() : "";
    if (typeof body.displayName === "string" && !displayName) return jsonError("Display name cannot be empty.", 400);

    const profile = await prisma.userProfile.update({
      where: { id: current.id },
      data: { displayName: displayName || null, bio: bio || null },
    });
    return jsonOk({ profile: serializeProfile(profile) });
  } catch (error) {
    if (error instanceof Error) return jsonError(error.message, authErrorStatus(error));
    return jsonErrorFromUnknown(error, "Could not update profile.", 500);
  }
}
```

Create `app/api/profile/claim-legacy-brands/route.ts`:

```ts
import { jsonError, jsonErrorFromUnknown, jsonOk } from "@/lib/request";
import { authErrorStatus } from "@/lib/auth/errors";
import { ensureCurrentUserProfile } from "@/lib/auth/currentUserProfile";
import { claimLegacyBrands } from "@/lib/auth/brandAccess";

export async function POST() {
  try {
    const profile = await ensureCurrentUserProfile();
    return jsonOk(await claimLegacyBrands({ profileId: profile.id }));
  } catch (error) {
    if (error instanceof Error) return jsonError(error.message, authErrorStatus(error));
    return jsonErrorFromUnknown(error, "Could not claim legacy brands.", 500);
  }
}
```

- [ ] **Step 4: Write failing component tests**

Create `tests/profile/profileComponents.test.tsx`:

```tsx
// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ProfileForm } from "@/components/profile/ProfileForm";
import { ClaimLegacyBrandsPanel } from "@/components/profile/ClaimLegacyBrandsPanel";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("profile components", () => {
  it("submits changed profile fields", async () => {
    const fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ profile: { displayName: "Kai", bio: "Builder" } }) });
    vi.stubGlobal("fetch", fetch);

    render(<ProfileForm profile={{ displayName: "", bio: "" }} />);

    fireEvent.change(screen.getByLabelText("Display name"), { target: { value: "Kai" } });
    fireEvent.change(screen.getByLabelText("Bio"), { target: { value: "Builder" } });
    fireEvent.click(screen.getByRole("button", { name: "Save profile" }));

    await waitFor(() => expect(fetch).toHaveBeenCalledWith("/api/profile", expect.objectContaining({ method: "PATCH" })));
  });

  it("claims legacy brands", async () => {
    const fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ claimedCount: 2 }) });
    vi.stubGlobal("fetch", fetch);

    render(<ClaimLegacyBrandsPanel brands={[{ id: "b1", name: "Acme" }, { id: "b2", name: "Beta" }]} />);

    fireEvent.click(screen.getByRole("button", { name: "Claim existing workspaces" }));

    await waitFor(() => expect(fetch).toHaveBeenCalledWith("/api/profile/claim-legacy-brands", { method: "POST" }));
    expect(await screen.findByText("Claimed 2 workspaces.")).toBeTruthy();
  });
});
```

- [ ] **Step 5: Implement profile components and page**

Create `components/profile/ProfileForm.tsx`:

```tsx
"use client";

import { useState } from "react";

export function ProfileForm({ profile }: { profile: { displayName: string; bio: string } }) {
  const [displayName, setDisplayName] = useState(profile.displayName);
  const [bio, setBio] = useState(profile.bio);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("");
    setError("");
    setLoading(true);
    const response = await fetch("/api/profile", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ displayName, bio }),
    });
    const json = await response.json();
    setLoading(false);
    if (!response.ok) {
      setError(json.error || "Could not save profile.");
      return;
    }
    setStatus("Profile saved.");
  }

  return (
    <form onSubmit={submit} className="space-y-4 spool-plate p-5">
      <label className="block space-y-1">
        <span className="text-sm font-medium text-ink">Display name</span>
        <input value={displayName} onChange={(event) => setDisplayName(event.target.value)} className="spool-field w-full" />
      </label>
      <label className="block space-y-1">
        <span className="text-sm font-medium text-ink">Bio</span>
        <textarea value={bio} onChange={(event) => setBio(event.target.value)} className="spool-field min-h-28 w-full" />
      </label>
      {error ? <p className="text-sm text-weak">{error}</p> : null}
      {status ? <p className="text-sm text-good">{status}</p> : null}
      <button type="submit" disabled={loading} className="spool-button disabled:opacity-60">
        {loading ? "Saving..." : "Save profile"}
      </button>
    </form>
  );
}
```

Create `components/profile/ClaimLegacyBrandsPanel.tsx`:

```tsx
"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type LegacyBrand = {
  id: string;
  name: string;
  twitterHandle?: string | null;
  category?: string | null;
};

export function ClaimLegacyBrandsPanel({ brands }: { brands: LegacyBrand[] }) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function claim() {
    setMessage("");
    setError("");
    setLoading(true);
    const response = await fetch("/api/profile/claim-legacy-brands", { method: "POST" });
    const json = await response.json();
    setLoading(false);
    if (!response.ok) {
      setError(json.error || "Could not claim existing workspaces.");
      return;
    }
    setMessage(`Claimed ${json.claimedCount} workspaces.`);
    router.refresh();
  }

  return (
    <section className="spool-plate-soft p-5">
      <p className="text-xs font-semibold uppercase text-muted">Existing workspaces</p>
      <h2 className="mt-1 text-xl font-semibold text-ink">Claim existing workspaces</h2>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
        These workspaces were created before app accounts existed. Claim them to attach them to your profile.
      </p>
      <div className="mt-3 flex flex-wrap gap-2 text-sm text-muted">
        {brands.slice(0, 4).map((brand) => (
          <span key={brand.id} className="border border-line bg-light px-2 py-1">
            {brand.name}
          </span>
        ))}
      </div>
      {message ? <p className="mt-3 text-sm text-good">{message}</p> : null}
      {error ? <p className="mt-3 text-sm text-weak">{error}</p> : null}
      <button type="button" onClick={claim} disabled={loading} className="spool-button mt-4 disabled:opacity-60">
        {loading ? "Claiming..." : "Claim existing workspaces"}
      </button>
    </section>
  );
}
```

Create `app/profile/page.tsx`:

```tsx
import { ProfileForm } from "@/components/profile/ProfileForm";
import { PageHeader } from "@/components/ui/PageHeader";
import { ensureCurrentUserProfile, serializeProfile } from "@/lib/auth/currentUserProfile";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const profile = serializeProfile(await ensureCurrentUserProfile());

  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader eyebrow="Account" title="Profile" description="Manage the app-local profile attached to your signed-in account." />
      <ProfileForm profile={profile} />
    </div>
  );
}
```

- [ ] **Step 6: Run tests**

```bash
npm test -- tests/profile/profileRoutes.test.ts tests/profile/profileComponents.test.tsx
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add app/api/profile app/profile components/profile tests/profile
git commit -m "feat: add profile and legacy claim flow"
```

## Task 6: Scope Brand APIs And Pages

**Files:**
- Modify: `app/api/brands/route.ts`
- Modify: `app/api/brands/[brandId]/route.ts`
- Modify: every file under `app/api/brands/[brandId]/**/route.ts`
- Modify: every page under `app/brands/[brandId]/**/page.tsx`
- Modify: `app/brands/new/page.tsx` if needed for signed-in copy
- Test: `tests/brands/brandRoutesAuth.test.ts`

- [ ] **Step 1: Write failing route tests for ownership**

Create `tests/brands/brandRoutesAuth.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import { BrandAccessError } from "@/lib/auth/errors";

const authBridge = vi.hoisted(() => ({
  ensureCurrentUserProfile: vi.fn(),
}));
const accessBridge = vi.hoisted(() => ({
  assertBrandAccess: vi.fn(),
  createBrandForProfile: vi.fn(),
}));
const dbBridge = vi.hoisted(() => ({
  prisma: {
    brand: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock("@/lib/auth/currentUserProfile", () => authBridge);
vi.mock("@/lib/auth/brandAccess", () => accessBridge);
vi.mock("@/lib/db", () => dbBridge);

describe("brand route auth", () => {
  beforeEach(() => vi.clearAllMocks());

  it("creates brands for the current profile", async () => {
    authBridge.ensureCurrentUserProfile.mockResolvedValue({ id: "profile1" });
    accessBridge.createBrandForProfile.mockResolvedValue({ id: "brand1", name: "Acme" });
    const { POST } = await import("@/app/api/brands/route");

    const response = await POST(new Request("http://localhost/api/brands", { method: "POST", body: JSON.stringify({ name: "Acme" }) }));

    expect(accessBridge.createBrandForProfile).toHaveBeenCalledWith({
      profileId: "profile1",
      input: expect.objectContaining({ name: "Acme" }),
    });
    await expect(response.json()).resolves.toMatchObject({ brand: { id: "brand1" } });
  });

  it("returns 404 when a user lacks brand access", async () => {
    authBridge.ensureCurrentUserProfile.mockResolvedValue({ id: "profile2" });
    accessBridge.assertBrandAccess.mockRejectedValue(new BrandAccessError());
    const { GET } = await import("@/app/api/brands/[brandId]/route");

    const response = await GET(new Request("http://localhost/api/brands/brand1"), { params: Promise.resolve({ brandId: "brand1" }) });

    expect(response.status).toBe(404);
  });
});
```

- [ ] **Step 2: Run tests to verify RED**

```bash
npm test -- tests/brands/brandRoutesAuth.test.ts
```

Expected: FAIL because routes do not call the new helpers yet.

- [ ] **Step 3: Update brand collection API**

Modify `app/api/brands/route.ts`:

```ts
import { ensureCurrentUserProfile } from "@/lib/auth/currentUserProfile";
import { createBrandForProfile } from "@/lib/auth/brandAccess";
import { prisma } from "@/lib/db";
import { jsonError, jsonErrorFromUnknown, jsonOk } from "@/lib/request";
import { listBrandWorkspaces } from "@/lib/brands/listBrandWorkspaces";

export async function GET() {
  try {
    const profile = await ensureCurrentUserProfile();
    return jsonOk(await listBrandWorkspaces(profile.id));
  } catch (error) {
    return jsonErrorFromUnknown(error, "Could not load brands.", 500);
  }
}

export async function POST(request: Request) {
  try {
    const profile = await ensureCurrentUserProfile();
    const body = await request.json();
    if (!body.name || typeof body.name !== "string") {
      return jsonError("Brand name is required.", 400);
    }

    const brand = await createBrandForProfile({
      profileId: profile.id,
      input: {
        name: body.name,
        twitterHandle: body.twitterHandle || null,
        website: body.website || null,
        category: body.category || null,
        audience: body.audience || null,
        description: body.description || null,
        beliefs: body.beliefs || null,
        avoidSoundingLike: body.avoidSoundingLike || null,
      },
    });

    return jsonOk({ brand }, { status: 201 });
  } catch (error) {
    return jsonErrorFromUnknown(error, "Could not create brand.", 500);
  }
}
```

Remove the unused `prisma` import if the editor leaves it behind.

- [ ] **Step 4: Update brand-specific API helper pattern**

In each `app/api/brands/[brandId]/**/route.ts`, add this pattern before brand-owned reads/writes:

```ts
const profile = await ensureCurrentUserProfile();
await assertBrandAccess({ profileId: profile.id, brandId });
```

For routes with error handling, catch `BrandAccessError` and return 404:

```ts
if (error instanceof Error) return jsonError(error.message, authErrorStatus(error));
```

Use this in:

- `app/api/brands/[brandId]/route.ts`
- `app/api/brands/[brandId]/analyze/route.ts`
- `app/api/brands/[brandId]/generate/route.ts`
- `app/api/brands/[brandId]/skill-file/route.ts`
- `app/api/brands/[brandId]/uploads/route.ts`
- `app/api/brands/[brandId]/uploads/[uploadId]/route.ts`
- `app/api/brands/[brandId]/rules/route.ts`
- `app/api/brands/[brandId]/rules/[ruleId]/route.ts`
- `app/api/brands/[brandId]/rules/selections/route.ts`
- `app/api/brands/[brandId]/rules/preview/route.ts`
- `app/api/brands/[brandId]/rules/apply/route.ts`

- [ ] **Step 5: Update brand pages**

In each `app/brands/[brandId]/**/page.tsx`, add:

```ts
const profile = await ensureCurrentUserProfile();
await assertBrandAccess({ profileId: profile.id, brandId });
```

If `assertBrandAccess` throws, call `notFound()`:

```ts
try {
  await assertBrandAccess({ profileId: profile.id, brandId });
} catch (error) {
  if (error instanceof BrandAccessError) notFound();
  throw error;
}
```

Use this in:

- `app/brands/[brandId]/page.tsx`
- `app/brands/[brandId]/upload/page.tsx`
- `app/brands/[brandId]/voice-report/page.tsx`
- `app/brands/[brandId]/skill-file/page.tsx`
- `app/brands/[brandId]/rules/page.tsx`
- `app/brands/[brandId]/studio/page.tsx`

- [ ] **Step 6: Run tests**

```bash
npm test -- tests/brands/brandRoutesAuth.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add app/api/brands app/brands tests/brands/brandRoutesAuth.test.ts
git commit -m "feat: scope brand routes by membership"
```

## Task 7: Scope Rules Bank Custom Rules By User

**Files:**
- Modify: `lib/rules/ruleBankService.ts`
- Modify: `app/api/rules/route.ts`
- Modify: `app/api/rules/[ruleId]/route.ts`
- Modify: `app/api/brands/[brandId]/rules/route.ts`
- Modify: `app/api/brands/[brandId]/rules/[ruleId]/route.ts`
- Test: `tests/rules/ruleBankService.test.ts`
- Test: `tests/rules/apiRoutes.test.ts`

- [ ] **Step 1: Write failing service tests**

Add to `tests/rules/ruleBankService.test.ts`:

```ts
it("lists starter rules plus global custom rules owned by the profile", async () => {
  const findMany = vi.fn().mockResolvedValue([]);
  await listGlobalRules({ prisma: { ruleBankRule: { findMany } }, profileId: "profile1" } as never);

  expect(findMany).toHaveBeenCalledWith(
    expect.objectContaining({
      where: {
        scope: "GLOBAL",
        OR: [{ source: "STARTER" }, { source: "CUSTOM", userProfileId: "profile1" }],
      },
    }),
  );
});

it("stores profile ownership on custom global rules", async () => {
  const create = vi.fn(async ({ data }) => ({ ...data, brandId: null, enabled: true }));
  const rule = await createCustomRule({
    prisma: { ruleBankRule: { create } },
    profileId: "profile1",
    input: {
      title: "Custom",
      body: "Use concrete anchors.",
      category: "specificity",
      mode: "guidance",
      scope: "global",
      targetJson: ["skill_rules"],
      payloadJson: {},
    },
  } as never);

  expect(create.mock.calls[0][0].data.userProfileId).toBe("profile1");
  expect(rule.source).toBe("custom");
});
```

- [ ] **Step 2: Run tests to verify RED**

```bash
npm test -- tests/rules/ruleBankService.test.ts
```

Expected: FAIL because service signatures do not accept `profileId`.

- [ ] **Step 3: Update service signatures**

Modify `lib/rules/ruleBankService.ts`:

- `listGlobalRules({ prisma, profileId })` filters starter rules plus custom rules for `profileId`.
- `createCustomRule({ prisma, brandId, profileId, input })` stores `userProfileId: profileId` for global custom rules and `null` for brand-scoped rules.
- `updateCustomRule({ prisma, ruleId, brandId, profileId, input })` requires profile ownership for global custom rules.
- `listApplicableBrandRules({ prisma, brandId, profileId })` returns starter rules, profile-owned global custom rules, and brand rules.

Use this filter shape:

```ts
function globalRulesWhere(profileId: string) {
  return {
    scope: "GLOBAL",
    OR: [{ source: "STARTER" }, { source: "CUSTOM", userProfileId: profileId }],
  };
}
```

- [ ] **Step 4: Update rules routes**

For `/api/rules` and `/api/rules/[ruleId]`, call `ensureCurrentUserProfile()` and pass `profile.id` into service calls.

For brand-scoped rules routes, first call `ensureCurrentUserProfile()`, then `assertBrandAccess`, then pass `profile.id` into service calls.

- [ ] **Step 5: Run rules tests**

```bash
npm test -- tests/rules/ruleBankService.test.ts tests/rules/apiRoutes.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add lib/rules/ruleBankService.ts app/api/rules app/api/brands/[brandId]/rules tests/rules/ruleBankService.test.ts tests/rules/apiRoutes.test.ts
git commit -m "feat: scope rules bank by user profile"
```

## Task 8: Protect Codex Local And Provider Mutation Endpoints

**Files:**
- Modify: `app/api/codex/status/route.ts`
- Modify: `app/api/codex/login/start/route.ts`
- Modify: `app/api/codex/login/cancel/route.ts`
- Modify: `app/api/codex/logout/route.ts`
- Test: `tests/codex/apiRoutes.test.ts`

- [ ] **Step 1: Add failing route test**

Add to `tests/codex/apiRoutes.test.ts`:

```ts
it("requires an app user before starting Codex login", async () => {
  vi.doMock("@/lib/auth/currentUserProfile", () => ({
    ensureCurrentUserProfile: vi.fn().mockRejectedValue(new Error("Sign in is required.")),
  }));
  const { POST } = await import("@/app/api/codex/login/start/route");

  const response = await POST();

  expect(response.status).toBe(500);
});
```

Then adjust the expected status to `401` after `authErrorStatus` is wired into the route.

- [ ] **Step 2: Run test to verify RED**

```bash
npm test -- tests/codex/apiRoutes.test.ts
```

Expected: FAIL until Codex routes call auth and map auth errors.

- [ ] **Step 3: Update Codex routes**

At the top of each Codex route handler, call:

```ts
await ensureCurrentUserProfile();
```

Catch errors with:

```ts
if (error instanceof Error) return jsonError(error.message, authErrorStatus(error));
```

- [ ] **Step 4: Run tests**

```bash
npm test -- tests/codex/apiRoutes.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/api/codex tests/codex/apiRoutes.test.ts
git commit -m "feat: protect Codex provider routes"
```

## Task 9: Full Verification And Live Auth Smoke

**Files:**
- No code edits unless verification exposes issues.

- [ ] **Step 1: Run formatting and schema checks**

```bash
git diff --check
DATABASE_URL='postgresql://user:pass@localhost:5432/db' DIRECT_URL='postgresql://user:pass@localhost:5432/db' npx prisma validate
DATABASE_URL='postgresql://user:pass@localhost:5432/db' DIRECT_URL='postgresql://user:pass@localhost:5432/db' npx prisma generate
```

Expected: all exit 0.

- [ ] **Step 2: Run test suite**

```bash
npm test
```

Expected: all test files pass.

- [ ] **Step 3: Run production build**

```bash
DATABASE_URL='postgresql://user:pass@localhost:5432/db' DIRECT_URL='postgresql://user:pass@localhost:5432/db' npm run build
```

Expected: build exits 0.

- [ ] **Step 4: Apply migration and seed on live dev database**

Only run this after confirming `.env` points to the intended development database:

```bash
set -a; source .env; set +a; npx prisma migrate deploy
```

Expected: migration `20260430010000_add_user_profiles_auth` applies.

- [ ] **Step 5: Start dev server**

```bash
set -a; source .env; set +a; npm run dev -- -H 127.0.0.1 -p 3001
```

Expected: server reports ready at `http://127.0.0.1:3001`.

- [ ] **Step 6: Live browser smoke**

With valid Clerk env vars:

1. Open `http://127.0.0.1:3001`.
2. Confirm signed-out user is redirected to sign-in.
3. Sign in with Clerk.
4. Confirm `/profile` loads and profile can be edited.
5. If legacy workspaces exist, claim them and confirm they show on `/`.
6. Create a new brand and confirm it appears only for the signed-in user.
7. Open Upload, Voice Report, Skill File, Rules Bank, Studio, and Settings.
8. Confirm Codex Local panel remains reachable after sign-in.

Expected: all routes work while signed in, and brand-specific URLs return not found for users without membership.

- [ ] **Step 7: Final status**

```bash
git status --short
```

Expected: clean working tree.

## Self-Review Notes

- Spec coverage: the tasks cover Clerk sign-in/sign-up, local profiles, brand ownership, legacy claim, protected routes/APIs, profile UI, global custom rule isolation, Codex Local protection, and live verification.
- Operational gap: live browser auth requires real Clerk environment variables. Without them, stop after unit tests/build and report that browser sign-in could not be completed.
- Scope control: invitations, teams, billing, custom password auth, and provider-key persistence stay out of this implementation.
