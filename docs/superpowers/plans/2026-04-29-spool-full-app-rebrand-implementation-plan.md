# Spool Full App Rebrand Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rename and restyle the existing voice studio as Spool, using the approved Riso Studio identity while preserving all current data, API, and LLM behavior.

**Architecture:** Keep the current Next.js App Router structure and Prisma-backed routes. Add a small local UI layer for Spool primitives, then update route and client component markup to consume the same tokens and utility classes. Do not modify database schema, voice pipeline modules, route handler behavior, or provider logic.

**Tech Stack:** Next.js App Router, React 19, TypeScript, Tailwind CSS, Prisma, Vitest, lucide-react.

---

## File Structure

- Modify `tailwind.config.ts`: Spool color tokens, radius, and hard-shadow tokens.
- Modify `app/globals.css`: font imports, paper texture, base element styles, reusable component utility classes.
- Create `components/ui/SpoolWordmark.tsx`: reusable Spool wordmark with thread mark.
- Create `components/ui/PageHeader.tsx`: shared route header with eyebrow, title, description, and back/action slot.
- Modify `app/layout.tsx`: metadata, app masthead, shell background, navigation copy.
- Modify `app/page.tsx`: Spool home entry screen and workspace list.
- Modify `app/brands/new/page.tsx`: Spool page header treatment.
- Modify `components/brands/BrandForm.tsx`: Spool form styles, no behavior changes.
- Modify `app/brands/[brandId]/page.tsx`: brand dashboard layout and labels.
- Modify `app/brands/[brandId]/upload/page.tsx`: keep "Upload Content" copy and restyle upload table.
- Modify `components/uploads/UploadForm.tsx`: upload form, summary, and sample previews.
- Modify `components/uploads/DeleteUploadButton.tsx`: secondary destructive button treatment.
- Modify `app/brands/[brandId]/voice-report/page.tsx`: shared header and page shell.
- Modify `components/voice-report/AnalyzeVoicePanel.tsx`: analysis printout styling.
- Modify `app/brands/[brandId]/skill-file/page.tsx`: shared header and empty state styling.
- Modify `components/skill-file/SkillFileEditor.tsx`: artifact summary, diff, JSON editor, and save states.
- Modify `app/brands/[brandId]/studio/page.tsx`: route label changes from Tweet Studio to Studio.
- Modify `components/studio/TweetStudio.tsx`: generation panel and draft review desk styling.
- Modify `components/studio/FeedbackButtons.tsx`: feedback controls and patch preview styling.
- Modify `app/settings/page.tsx`: Provider Settings page treatment.
- Modify `components/settings/ProviderSettingsForm.tsx`: Spool form styles and storage key compatibility note.

## Guardrails

- Do not edit files under `lib/voice`, `lib/llm`, `app/api`, `prisma`, or `tests` unless a build error proves a UI import needs a type-only fix.
- Do not rename database fields, API routes, or enum values.
- Keep **Upload Content** exactly as the page label.
- Keep form labels direct and user-friendly.
- Use existing route paths.
- Commit after each task that leaves the app building.

### Task 1: Baseline Verification

**Files:**
- Read only: repository root

- [ ] **Step 1: Confirm the worktree is clean except expected plan/spec commits**

Run:

```bash
git status --short
```

Expected: no unstaged or untracked product-code files. Ignored local files such as `.env`, `.next`, `node_modules`, `.superpowers`, and `.DS_Store` are fine.

- [ ] **Step 2: Run the existing unit suite before UI changes**

Run:

```bash
npm test
```

Expected: PASS. If a test fails before code changes, record the failure and stop to decide whether it is environmental.

- [ ] **Step 3: Run a production build before UI changes**

Run:

```bash
npm run build
```

Expected: PASS. If build requires environment variables or database access, record the exact blocker before continuing.

### Task 2: Add Spool Design Tokens And Reusable UI Primitives

**Files:**
- Modify: `tailwind.config.ts`
- Modify: `app/globals.css`
- Create: `components/ui/SpoolWordmark.tsx`
- Create: `components/ui/PageHeader.tsx`

- [ ] **Step 1: Update Tailwind theme tokens**

Replace the `theme.extend` block in `tailwind.config.ts` with:

```ts
extend: {
  colors: {
    paper: "#f1e6cc",
    light: "#fef7e3",
    ink: "#1a3540",
    muted: "rgba(26, 53, 64, 0.68)",
    panel: "#fef7e3",
    surface: "#fff9ea",
    line: "rgba(26, 53, 64, 0.2)",
    accent: "#ff5728",
    good: "#1f7a3f",
    warn: "#b45309",
    weak: "#b91c1c",
  },
  borderRadius: {
    ui: "4px",
  },
  boxShadow: {
    stamp: "2px 2px 0 #1a3540",
    plate: "4px 4px 0 #1a3540",
    orange: "4px 4px 0 #ff5728",
  },
  fontFamily: {
    sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
    display: ["Fraunces", "Georgia", "serif"],
    mono: ["IBM Plex Mono", "ui-monospace", "monospace"],
  },
}
```

- [ ] **Step 2: Replace global CSS with Spool base styling**

Replace `app/globals.css` with:

```css
@import url("https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400..700;1,9..144,400..600&family=IBM+Plex+Mono:wght@400;500;600&family=Inter:wght@400;500;600;700&display=swap");

@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  --paper: #f1e6cc;
  --light: #fef7e3;
  --surface: #fff9ea;
  --ink: #1a3540;
  --orange: #ff5728;
  --forest: #1f7a3f;
  --line: rgba(26, 53, 64, 0.2);
  --halftone: rgba(255, 87, 40, 0.04);
}

* {
  box-sizing: border-box;
}

html {
  color-scheme: light;
}

body {
  margin: 0;
  min-height: 100vh;
  background-color: var(--paper);
  background-image:
    radial-gradient(circle at 12% 18%, rgba(26, 53, 64, 0.05) 0.5px, transparent 1px),
    radial-gradient(circle at 78% 38%, rgba(26, 53, 64, 0.06) 0.5px, transparent 1px),
    radial-gradient(circle at 32% 76%, rgba(26, 53, 64, 0.05) 0.5px, transparent 1px),
    repeating-radial-gradient(circle at 0 0, var(--halftone) 0 0.8px, transparent 0.8px 6px);
  background-size: 4px 4px, 5px 5px, 6px 6px, 6px 6px;
  color: var(--ink);
  font-family: Inter, ui-sans-serif, system-ui, sans-serif;
  -webkit-font-smoothing: antialiased;
}

a {
  color: inherit;
  text-decoration: none;
}

textarea,
input,
select,
button {
  font: inherit;
}

::selection {
  background: var(--orange);
  color: var(--light);
}

@layer components {
  .spool-rule {
    border-color: var(--ink);
    border-top-width: 1.5px;
    border-bottom-width: 1.5px;
  }

  .spool-plate {
    border: 1.5px solid var(--ink);
    background: var(--light);
    box-shadow: 4px 4px 0 var(--ink);
  }

  .spool-plate-soft {
    border: 1.5px solid var(--line);
    background: var(--surface);
  }

  .spool-stamp {
    display: inline-flex;
    align-items: center;
    width: fit-content;
    border: 1.5px solid var(--orange);
    background: rgba(255, 87, 40, 0.07);
    color: var(--orange);
    font-family: "IBM Plex Mono", ui-monospace, monospace;
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0;
    line-height: 1;
    padding: 6px 9px;
    text-transform: uppercase;
    transform: rotate(-1.5deg);
  }

  .spool-button {
    border: 1.5px solid var(--ink);
    background: var(--orange);
    box-shadow: 3px 3px 0 var(--ink);
    color: var(--light);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-size: 0.875rem;
    font-weight: 700;
    min-height: 2.5rem;
    padding: 0.55rem 1rem;
    text-transform: none;
    transition: transform 80ms ease-out, box-shadow 120ms ease-out;
  }

  .spool-button:hover {
    box-shadow: 4px 4px 0 var(--ink);
  }

  .spool-button:active {
    box-shadow: none;
    transform: translate(3px, 3px);
  }

  .spool-button:disabled {
    cursor: not-allowed;
    opacity: 0.5;
  }

  .spool-button-secondary {
    border: 1.5px solid var(--ink);
    background: var(--light);
    color: var(--ink);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-size: 0.875rem;
    font-weight: 600;
    min-height: 2.5rem;
    padding: 0.55rem 1rem;
  }

  .spool-field {
    border: 1.5px solid var(--ink);
    background: var(--light);
    color: var(--ink);
  }

  .spool-field:focus {
    border-color: var(--orange);
    outline: 2px dashed rgba(255, 87, 40, 0.45);
    outline-offset: 2px;
  }
}
```

- [ ] **Step 3: Create the Spool wordmark component**

Create `components/ui/SpoolWordmark.tsx`:

```tsx
import clsx from "clsx";

export function SpoolWordmark({ className }: { className?: string }) {
  return (
    <span className={clsx("inline-flex items-baseline gap-2 font-display italic tracking-normal text-ink", className)}>
      <span>Spool</span>
      <span
        aria-hidden="true"
        className="inline-block size-[0.55em] rounded-full border-[1.5px] border-accent shadow-[inset_0_0_0_0.16em_var(--paper),inset_0_0_0_0.2em_var(--ink)]"
      />
    </span>
  );
}
```

- [ ] **Step 4: Create the shared page header component**

Create `components/ui/PageHeader.tsx`:

```tsx
import type { ReactNode } from "react";

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-col justify-between gap-4 border-b-[1.5px] border-ink pb-6 md:flex-row md:items-start">
      <div>
        {eyebrow ? <p className="font-mono text-[10px] font-semibold uppercase tracking-normal text-accent">{eyebrow}</p> : null}
        <h1 className="mt-2 font-display text-4xl font-semibold leading-none tracking-normal text-ink md:text-5xl">{title}</h1>
        {description ? <p className="mt-3 max-w-3xl text-sm leading-6 text-muted">{description}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}
```

- [ ] **Step 5: Verify TypeScript accepts the new components**

Run:

```bash
npm run build
```

Expected: PASS.

- [ ] **Step 6: Commit token and primitive changes**

Run:

```bash
git add tailwind.config.ts app/globals.css components/ui/SpoolWordmark.tsx components/ui/PageHeader.tsx
git commit -m "feat: add spool design system"
```

### Task 3: Rebrand App Shell, Metadata, Home, And New Brand Page

**Files:**
- Modify: `app/layout.tsx`
- Modify: `app/page.tsx`
- Modify: `app/brands/new/page.tsx`
- Modify: `components/brands/BrandForm.tsx`

- [ ] **Step 1: Update app metadata and masthead**

In `app/layout.tsx`, import `SpoolWordmark`, set metadata to:

```ts
export const metadata: Metadata = {
  title: "Spool",
  description: "Build a reusable voice engine for posts, threads, and launches.",
};
```

Replace the header JSX with a paper masthead:

```tsx
<header className="border-b-[1.5px] border-ink bg-paper/95">
  <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4 md:px-6">
    <Link href="/" aria-label="Spool home">
      <SpoolWordmark className="text-3xl" />
    </Link>
    <nav className="flex items-center gap-3 font-mono text-[10px] font-semibold uppercase tracking-normal text-ink">
      <Link href="/settings" className="hover:text-accent">
        Provider Settings
      </Link>
      <Link href="/brands/new" className="spool-button min-h-9 px-3 py-2 font-sans text-xs normal-case tracking-normal">
        New brand
      </Link>
    </nav>
  </div>
</header>
<main className="mx-auto max-w-6xl px-5 py-8 md:px-6">{children}</main>
```

- [ ] **Step 2: Restyle Home**

In `app/page.tsx`, import `SpoolWordmark`. Replace the hero heading/copy with:

```tsx
<section className="spool-rule pb-8 pt-6">
  <p className="spool-stamp">Posts / threads / launches</p>
  <h1 className="mt-7 max-w-4xl font-display text-6xl font-semibold leading-[0.88] tracking-normal text-ink md:text-8xl">
    <SpoolWordmark />
  </h1>
  <p className="mt-6 max-w-2xl font-display text-2xl italic leading-tight text-ink md:text-3xl">
    Build a reusable voice engine from real writing.
  </p>
  <p className="mt-4 max-w-2xl text-base leading-7 text-muted">
    Upload past social writing, turn it into a Skill File, and draft posts that stay close to the voice.
  </p>
  <Link href="/brands/new" className="spool-button mt-6">
    Create Brand Voice Workspace
  </Link>
</section>
```

Keep the `brands` query unchanged. Style the workspace list as Spool plates with `spool-plate`, and keep the section heading **Brand workspaces**.

- [ ] **Step 3: Restyle new brand page**

In `app/brands/new/page.tsx`, import `PageHeader` and replace the top block with:

```tsx
<div className="max-w-4xl space-y-6">
  <PageHeader
    eyebrow="New workspace"
    title="Create Brand Voice Workspace"
    description="Capture the context the voice file should preserve."
  />
  <BrandForm />
</div>
```

- [ ] **Step 4: Restyle `BrandForm` without changing payload behavior**

In `components/brands/BrandForm.tsx`:

- Change the form container to `className="space-y-5 spool-plate p-5"`.
- Change every input and textarea class to include `spool-field`.
- Change the submit button class to `className="spool-button disabled:opacity-60"`.
- Keep field `name` values unchanged.

- [ ] **Step 5: Verify shell and home compile**

Run:

```bash
npm run build
```

Expected: PASS.

- [ ] **Step 6: Commit shell and home work**

Run:

```bash
git add app/layout.tsx app/page.tsx app/brands/new/page.tsx components/brands/BrandForm.tsx
git commit -m "feat: rebrand shell as spool"
```

### Task 4: Rebrand Brand Dashboard And Upload Flow

**Files:**
- Modify: `app/brands/[brandId]/page.tsx`
- Modify: `app/brands/[brandId]/upload/page.tsx`
- Modify: `components/uploads/UploadForm.tsx`
- Modify: `components/uploads/DeleteUploadButton.tsx`

- [ ] **Step 1: Update brand dashboard header**

In `app/brands/[brandId]/page.tsx`, import `PageHeader`. Replace the existing top header block with:

```tsx
<PageHeader
  eyebrow={brand.twitterHandle || brand.category || "Brand workspace"}
  title={brand.name}
  description={brand.description || "Upload past writing to build a reusable Skill File."}
  actions={
    <Link href="/" className="spool-button-secondary text-sm">
      Back to workspaces
    </Link>
  }
/>
```

Keep all Prisma queries and next-action logic unchanged.

- [ ] **Step 2: Restyle dashboard metrics and actions**

Update metric blocks and current-stage panels to use `spool-plate` or `spool-plate-soft`. Keep labels unchanged: Useful samples, Latest upload, Voice report, Skill file, Current stage, Voice health, All actions, Brand context, Avoid sounding like.

For primary next action links, use:

```tsx
className="spool-button mt-4"
```

For secondary action links, use:

```tsx
className="spool-button-secondary text-sm"
```

- [ ] **Step 3: Keep Upload Content label and restyle upload page header**

In `app/brands/[brandId]/upload/page.tsx`, import `PageHeader` and replace the header block with:

```tsx
<PageHeader
  eyebrow={brand.name}
  title="Upload Content"
  description="Upload past Twitter/X writing so Spool can parse, clean, and identify useful voice samples."
  actions={
    <Link href={`/brands/${brand.id}`} className="spool-button-secondary text-sm">
      Brand dashboard
    </Link>
  }
/>
```

- [ ] **Step 4: Restyle upload form and summary**

In `components/uploads/UploadForm.tsx`:

- Change the upload form to `className="spool-plate p-5"`.
- Change the file input to include `spool-field`.
- Change submit button to `className="spool-button mt-4 disabled:opacity-60"`.
- Change summary container to `className="space-y-5 spool-plate p-5"`.
- Change summary count blocks to `spool-plate-soft p-3`.
- Change sample preview list items to `spool-plate-soft whitespace-pre-wrap p-3 text-sm leading-6 text-ink`.
- Change Analyze link to `className="spool-button text-center"`.

- [ ] **Step 5: Restyle recent uploads table and delete button**

In `app/brands/[brandId]/upload/page.tsx`, change the table wrapper to:

```tsx
<div className="mt-4 overflow-x-auto border-[1.5px] border-ink bg-light shadow-stamp">
```

Use `bg-surface` for `thead`, `border-t border-line` for rows, and keep every column unchanged.

In `components/uploads/DeleteUploadButton.tsx`, change the button class to:

```tsx
className="spool-button-secondary min-h-8 px-3 py-1.5 text-xs text-weak hover:border-weak disabled:opacity-60"
```

- [ ] **Step 6: Verify dashboard and upload compile**

Run:

```bash
npm run build
```

Expected: PASS.

- [ ] **Step 7: Commit dashboard and upload work**

Run:

```bash
git add 'app/brands/[brandId]/page.tsx' 'app/brands/[brandId]/upload/page.tsx' components/uploads/UploadForm.tsx components/uploads/DeleteUploadButton.tsx
git commit -m "feat: restyle spool workspace and upload"
```

### Task 5: Rebrand Voice Report And Skill File Surfaces

**Files:**
- Modify: `app/brands/[brandId]/voice-report/page.tsx`
- Modify: `components/voice-report/AnalyzeVoicePanel.tsx`
- Modify: `app/brands/[brandId]/skill-file/page.tsx`
- Modify: `components/skill-file/SkillFileEditor.tsx`

- [ ] **Step 1: Update Voice Report route header**

In `app/brands/[brandId]/voice-report/page.tsx`, import `PageHeader` and replace the header block with:

```tsx
<PageHeader
  eyebrow={brand.name}
  title="Voice Report"
  description="Turn useful writing samples into a structured report and reusable Skill File."
  actions={
    <Link href={`/brands/${brand.id}`} className="spool-button-secondary text-sm">
      Brand dashboard
    </Link>
  }
/>
```

- [ ] **Step 2: Restyle report sections**

In `components/voice-report/AnalyzeVoicePanel.tsx`:

- Change `ToneSlider` track to `bg-line` and fill to `bg-accent`.
- Change report section containers from `rounded-ui border border-line bg-white p-5` to `spool-plate p-5`.
- Change nested evidence/example boxes to `spool-plate-soft p-3`.
- Change the analysis command panel to `spool-plate p-5`.
- Change analyze button to `className="spool-button disabled:opacity-60"`.
- Change mode label to `className="spool-stamp mt-2"`.
- Change the no-report copy to a direct empty state inside `spool-plate-soft p-4`.
- Change bottom action links to `spool-button` and `spool-button-secondary`.

- [ ] **Step 3: Update Skill File route header**

In `app/brands/[brandId]/skill-file/page.tsx`, import `PageHeader` and replace the header block with:

```tsx
<PageHeader
  eyebrow={brand.name}
  title="Skill File"
  description="The reusable JSON voice artifact. Saving edits creates a new version."
  actions={
    <Link href={`/brands/${brand.id}`} className="spool-button-secondary text-sm">
      Brand dashboard
    </Link>
  }
/>
```

Keep the no-skill-file logic unchanged and style the empty state with `spool-plate p-5`.

- [ ] **Step 4: Restyle `SkillFileEditor`**

In `components/skill-file/SkillFileEditor.tsx`:

- Change the top artifact summary section to `className="space-y-4 spool-plate p-5"`.
- Change the version pill to `className="spool-stamp"`.
- Change summary mini panels to `spool-plate-soft p-3`.
- Change retrieval hint chips to `className="border border-line bg-light px-2 py-1 text-xs text-ink"`.
- Change the voice kernel and version diff panels to `spool-plate-soft p-4`.
- Change JSON textarea to include `spool-field`.
- Change save button to `className="spool-button disabled:opacity-60"`.

- [ ] **Step 5: Verify report and skill file compile**

Run:

```bash
npm run build
```

Expected: PASS.

- [ ] **Step 6: Commit report and skill file work**

Run:

```bash
git add 'app/brands/[brandId]/voice-report/page.tsx' components/voice-report/AnalyzeVoicePanel.tsx 'app/brands/[brandId]/skill-file/page.tsx' components/skill-file/SkillFileEditor.tsx
git commit -m "feat: restyle spool reports and skill files"
```

### Task 6: Rebrand Studio, Feedback, And Provider Settings

**Files:**
- Modify: `app/brands/[brandId]/studio/page.tsx`
- Modify: `components/studio/TweetStudio.tsx`
- Modify: `components/studio/FeedbackButtons.tsx`
- Modify: `app/settings/page.tsx`
- Modify: `components/settings/ProviderSettingsForm.tsx`

- [ ] **Step 1: Update Studio route header**

In `app/brands/[brandId]/studio/page.tsx`, import `PageHeader` and replace the header block with:

```tsx
<PageHeader
  eyebrow={brand.name}
  title="Studio"
  description="Generate social drafts from the latest Skill File and improve it with feedback."
  actions={
    <Link href={`/brands/${brand.id}`} className="spool-button-secondary text-sm">
      Brand dashboard
    </Link>
  }
/>
```

Keep the `TweetStudio` component name and imports unchanged. Component names do not need to match product copy.

- [ ] **Step 2: Restyle generation panel in `TweetStudio`**

In `components/studio/TweetStudio.tsx`:

- Change the form container to `className="h-fit space-y-5 spool-plate p-5"`.
- Change provider and voice evidence panels to `spool-plate-soft p-3`.
- Change textarea/select/input classes to include `spool-field`.
- Change primary submit button to `className="spool-button disabled:opacity-60"`.
- Keep request body keys and state names unchanged.

- [ ] **Step 3: Restyle draft review desk**

In `components/studio/TweetStudio.tsx`:

- Change empty state to `className="spool-plate p-5"`.
- Change generated draft `article` to `className="space-y-4 spool-plate p-5"`.
- Change revised draft label to `className="spool-stamp bg-good/10 text-good"`.
- Change score box to `className="shrink-0 border-[1.5px] border-ink bg-surface px-3 py-2 text-right shadow-stamp"`.
- Change score breakdown and style distance boxes to `spool-plate-soft p-3`.
- Change evidence details to `spool-plate-soft p-3`.

- [ ] **Step 4: Restyle feedback controls**

In `components/studio/FeedbackButtons.tsx`:

- Change note textarea and reason select to include `spool-field`.
- Change action-strip container to `spool-plate-soft p-3`.
- Change primary revise and teach buttons to `spool-button`.
- Change preview, approve, reject, patch-only, keep-editing, fresh-batch, and review-skill-file buttons to `spool-button-secondary`.
- Keep icon imports and all API calls unchanged.

- [ ] **Step 5: Update Provider Settings route and form**

In `app/settings/page.tsx`, import `PageHeader` and render:

```tsx
<div className="max-w-3xl space-y-6">
  <PageHeader
    eyebrow="Settings"
    title="Provider Settings"
    description="Bring your own key for Anthropic, OpenAI, OpenRouter, or an OpenAI-compatible endpoint. API keys are stored only in this browser's localStorage."
  />
  <ProviderSettingsForm />
</div>
```

In `components/settings/ProviderSettingsForm.tsx`:

- Keep `PROVIDER_STORAGE_KEY = "voice-skill-file-provider-config"` unchanged to avoid breaking existing local settings.
- Change the form container to `className="space-y-5 spool-plate p-5"`.
- Change every input/select to include `spool-field`.
- Change the submit button to `className="spool-button"`.
- Change mode label to `className="spool-stamp mt-2"`.

- [ ] **Step 6: Verify studio and settings compile**

Run:

```bash
npm run build
```

Expected: PASS.

- [ ] **Step 7: Commit studio and settings work**

Run:

```bash
git add 'app/brands/[brandId]/studio/page.tsx' components/studio/TweetStudio.tsx components/studio/FeedbackButtons.tsx app/settings/page.tsx components/settings/ProviderSettingsForm.tsx
git commit -m "feat: restyle spool studio and settings"
```

### Task 7: Final Verification And Browser Review

**Files:**
- Read only unless verification finds a concrete UI regression.

- [ ] **Step 1: Run full unit suite**

Run:

```bash
npm test
```

Expected: PASS.

- [ ] **Step 2: Run production build**

Run:

```bash
npm run build
```

Expected: PASS.

- [ ] **Step 3: Try lint command**

Run:

```bash
npm run lint -- --max-warnings=0
```

Expected: PASS or a documented tool-level blocker if `next lint` is unavailable in the installed Next.js version.

- [ ] **Step 4: Start local dev server**

Run:

```bash
npm run dev
```

Expected: dev server starts and prints a localhost URL.

- [ ] **Step 5: Browser-check core routes**

Open the dev server in the in-app browser and inspect:

```text
/
/brands/new
/settings
```

If a seeded brand exists, also inspect:

```text
/brands/[brandId]
/brands/[brandId]/upload
/brands/[brandId]/voice-report
/brands/[brandId]/skill-file
/brands/[brandId]/studio
```

Expected:

- Spool wordmark is obvious on Home and masthead.
- Paper texture is visible but does not hurt readability.
- No text overlaps at desktop or mobile widths.
- Upload Content label is unchanged.
- Tables remain readable.
- Form controls are clear.
- Studio drafts remain easy to scan.

- [ ] **Step 6: Stop dev server**

Stop the dev server cleanly with `Ctrl-C` in the terminal session used to start it.

- [ ] **Step 7: Commit final verification fixes if needed**

If browser review required fixes, commit them:

```bash
git add app components tailwind.config.ts
git commit -m "fix: polish spool responsive UI"
```

If no fixes were required, do not create an empty commit.

## Execution Notes

- The plan intentionally avoids unit tests for visual styling because the current Vitest setup uses a Node environment and has no React DOM test harness. Build checks and browser verification are the reliable guardrails for this rebrand.
- If a class name typo or type error appears during build, fix only the affected UI file and rerun the same command.
- If a database or provider environment issue appears during build or browser verification, document the exact error and continue only with routes that can be verified locally.
