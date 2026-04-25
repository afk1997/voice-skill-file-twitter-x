# Voice Skill File for Twitter/X Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a local single-user MVP that ingests Twitter/X writing samples, creates a reusable Voice Skill File, generates tweets in that voice, and updates the skill file from feedback.

**Architecture:** Build a modular monolith using Next.js App Router route handlers, Prisma/SQLite persistence, and small domain modules under `lib/`. Route handlers stay thin and call testable tweet, voice, and LLM workflow functions. BYOK keys are read from request-scoped browser settings or `.env.local`, never from SQLite.

**Tech Stack:** Next.js App Router, TypeScript, Tailwind CSS, Prisma, SQLite, Vitest, React Hook Form-free server/client forms, JSZip, csv-parse, optional provider APIs for Anthropic/OpenAI/OpenRouter/OpenAI-compatible models.

---

## Scope Check

The approved design spans ingestion, voice analysis, generation, feedback, and UI, but these are one connected MVP workflow rather than independent products. Keep this as one implementation plan with frequent commits and working checkpoints.

## File Structure

Create or modify these files:

- `package.json`: scripts and dependencies.
- `tsconfig.json`, `next.config.ts`, `postcss.config.mjs`, `tailwind.config.ts`, `.eslintrc.json`, `.gitignore`, `.env.example`: project configuration.
- `vitest.config.ts`: unit test configuration.
- `app/layout.tsx`, `app/globals.css`, `app/page.tsx`: root layout, styles, and workspace list.
- `app/settings/page.tsx`, `components/settings/ProviderSettingsForm.tsx`: BYOK localStorage settings.
- `app/brands/new/page.tsx`, `components/brands/BrandForm.tsx`: brand creation.
- `app/brands/[brandId]/page.tsx`: brand dashboard.
- `app/brands/[brandId]/upload/page.tsx`, `components/uploads/UploadForm.tsx`: upload flow.
- `app/brands/[brandId]/voice-report/page.tsx`: voice report display.
- `app/brands/[brandId]/skill-file/page.tsx`, `components/skill-file/SkillFileEditor.tsx`: JSON editor.
- `app/brands/[brandId]/studio/page.tsx`, `components/studio/TweetStudio.tsx`, `components/studio/FeedbackButtons.tsx`: generation and feedback.
- `app/api/brands/route.ts`, `app/api/brands/[brandId]/route.ts`: brand API.
- `app/api/brands/[brandId]/uploads/route.ts`: upload API.
- `app/api/brands/[brandId]/analyze/route.ts`: voice analysis API.
- `app/api/brands/[brandId]/skill-file/route.ts`: skill file API.
- `app/api/brands/[brandId]/generate/route.ts`: generation API.
- `app/api/generations/[generationId]/feedback/route.ts`: feedback API.
- `prisma/schema.prisma`, `prisma/seed.ts`: database schema and optional sample seed.
- `lib/db.ts`: Prisma singleton.
- `lib/types.ts`: shared TypeScript types.
- `lib/constants.ts`: tweet types, feedback labels, banned phrases, caps.
- `lib/request.ts`: JSON response helpers and provider config extraction.
- `lib/tweets/cleanTweet.ts`, `lib/tweets/classifyTweet.ts`, `lib/tweets/parseTwitterArchive.ts`: ingestion domain logic.
- `lib/voice/analyzeVoice.ts`, `lib/voice/createSkillFile.ts`, `lib/voice/evaluateTweet.ts`, `lib/voice/generateTweets.ts`, `lib/voice/updateSkillFileFromFeedback.ts`, `lib/voice/versioning.ts`: voice workflows.
- `lib/llm/client.ts`, `lib/llm/mockProvider.ts`, `lib/llm/prompts/analyzeVoicePrompt.ts`, `lib/llm/prompts/generateTweetPrompt.ts`, `lib/llm/prompts/evaluateTweetPrompt.ts`: provider facade and prompts.
- `tests/tweets/*.test.ts`, `tests/voice/*.test.ts`: focused unit tests.

## Task 1: Project Foundation

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `next.config.ts`
- Create: `postcss.config.mjs`
- Create: `tailwind.config.ts`
- Create: `.eslintrc.json`
- Create: `.gitignore`
- Create: `.env.example`
- Create: `vitest.config.ts`
- Create: `app/layout.tsx`
- Create: `app/globals.css`
- Create: `app/page.tsx`

- [ ] **Step 1: Create the package manifest**

Use `apply_patch` to create `package.json` with these scripts and dependencies:

```json
{
  "name": "voice-skill-file-twitter-x",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "test": "vitest run",
    "test:watch": "vitest",
    "prisma:generate": "prisma generate",
    "prisma:migrate": "prisma migrate dev",
    "prisma:seed": "tsx prisma/seed.ts"
  },
  "dependencies": {
    "@prisma/client": "^5.22.0",
    "class-variance-authority": "^0.7.1",
    "clsx": "^2.1.1",
    "csv-parse": "^5.6.0",
    "jszip": "^3.10.1",
    "lucide-react": "^0.468.0",
    "next": "^15.0.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "tailwind-merge": "^2.5.5",
    "zod": "^3.24.1"
  },
  "devDependencies": {
    "@testing-library/react": "^16.1.0",
    "@types/node": "^22.10.2",
    "@types/react": "^19.0.1",
    "@types/react-dom": "^19.0.2",
    "autoprefixer": "^10.4.20",
    "eslint": "^9.17.0",
    "eslint-config-next": "^15.0.0",
    "postcss": "^8.4.49",
    "prisma": "^5.22.0",
    "tailwindcss": "^3.4.17",
    "tsx": "^4.19.2",
    "typescript": "^5.7.2",
    "vitest": "^2.1.8"
  }
}
```

- [ ] **Step 2: Create TypeScript and Next config**

Create `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2017",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": false,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

Create `next.config.ts`:

```ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {};

export default nextConfig;
```

Create `vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
});
```

- [ ] **Step 3: Create Tailwind, ESLint, git, and env config**

Create `postcss.config.mjs`:

```js
const config = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};

export default config;
```

Create `tailwind.config.ts`:

```ts
import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#111827",
        muted: "#6b7280",
        panel: "#f8fafc",
        line: "#e5e7eb",
        accent: "#2563eb",
        good: "#15803d",
        warn: "#b45309",
        weak: "#b91c1c"
      },
      borderRadius: {
        ui: "8px"
      }
    },
  },
  plugins: [],
};

export default config;
```

Create `.eslintrc.json`:

```json
{
  "extends": ["next/core-web-vitals"]
}
```

Create `.gitignore`:

```gitignore
node_modules
.next
dist
coverage
.env
.env.local
dev.db
dev.db-journal
.superpowers/
```

Create `.env.example`:

```bash
DATABASE_URL="file:./dev.db"
ANTHROPIC_API_KEY=""
OPENAI_API_KEY=""
OPENROUTER_API_KEY=""
OPENAI_COMPATIBLE_API_KEY=""
OPENAI_COMPATIBLE_BASE_URL=""
```

- [ ] **Step 4: Create the minimal app shell**

Create `app/layout.tsx`:

```tsx
import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Voice Skill File for Twitter/X",
  description: "Upload past writing. Build a reusable voice file. Generate tweets that sound like you.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header className="border-b border-line bg-white">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
            <Link href="/" className="text-sm font-semibold tracking-normal text-ink">
              Voice Skill File
            </Link>
            <nav className="flex items-center gap-4 text-sm text-muted">
              <Link href="/settings" className="hover:text-ink">Settings</Link>
              <Link href="/brands/new" className="rounded-ui bg-ink px-3 py-2 text-white hover:bg-black">New brand</Link>
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
      </body>
    </html>
  );
}
```

Create `app/globals.css`:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  background: #ffffff;
  color: #111827;
  font-family: Arial, Helvetica, sans-serif;
}

a {
  text-decoration: none;
}

textarea,
input,
select {
  font: inherit;
}
```

Create `app/page.tsx` initially:

```tsx
import Link from "next/link";

export default function HomePage() {
  return (
    <div className="space-y-8">
      <section className="border-b border-line pb-8">
        <p className="text-sm font-medium text-accent">Twitter/X brand voice replication</p>
        <h1 className="mt-3 max-w-3xl text-4xl font-semibold tracking-normal text-ink">
          Upload your past writing. Get a reusable Voice Skill File. Generate tweets that sound like you.
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-7 text-muted">
          This local MVP turns archive samples into a structured voice file, then uses it to draft and refine Twitter-native posts.
        </p>
        <Link href="/brands/new" className="mt-6 inline-flex rounded-ui bg-ink px-4 py-2 text-sm font-medium text-white hover:bg-black">
          Create Brand Voice Workspace
        </Link>
      </section>
      <section>
        <h2 className="text-xl font-semibold text-ink">Brand workspaces</h2>
        <p className="mt-2 text-sm text-muted">Workspaces will appear here after the database is wired.</p>
      </section>
    </div>
  );
}
```

- [ ] **Step 5: Install dependencies**

Run:

```bash
npm install
```

Expected: dependencies install and `package-lock.json` is created.

- [ ] **Step 6: Run baseline checks**

Run:

```bash
npm run test
npm run build
```

Expected: Vitest reports no tests found or passes if empty test discovery is allowed. Next build completes for the static shell.

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json tsconfig.json next.config.ts postcss.config.mjs tailwind.config.ts .eslintrc.json .gitignore .env.example vitest.config.ts app
git commit -m "chore: scaffold Next app foundation"
```

## Task 2: Prisma Schema and Database Client

**Files:**
- Create: `prisma/schema.prisma`
- Create: `prisma/seed.ts`
- Create: `lib/db.ts`

- [ ] **Step 1: Create Prisma schema**

Create `prisma/schema.prisma`:

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}

model Brand {
  id                 String              @id @default(cuid())
  name               String
  twitterHandle      String?
  website            String?
  category           String?
  audience           String?
  description        String?
  beliefs            String?
  avoidSoundingLike  String?
  createdAt          DateTime            @default(now())
  updatedAt          DateTime            @updatedAt

  uploads            Upload[]
  contentSamples     ContentSample[]
  voiceReports       VoiceReportRecord[]
  skillFiles         SkillFile[]
  generations        Generation[]
}

model Upload {
  id            String   @id @default(cuid())
  brandId       String
  brand         Brand    @relation(fields: [brandId], references: [id], onDelete: Cascade)
  fileName      String
  fileType      String
  status        String
  totalItems    Int      @default(0)
  usefulItems   Int      @default(0)
  excludedItems Int      @default(0)
  summaryJson   Json?
  createdAt     DateTime @default(now())
}

model ContentSample {
  id             String   @id @default(cuid())
  brandId        String
  brand          Brand    @relation(fields: [brandId], references: [id], onDelete: Cascade)
  uploadId       String?
  rawText        String
  cleanedText    String
  sourceType     String
  classification String
  qualityScore   Int
  usedForVoice   Boolean  @default(false)
  metadataJson   Json?
  createdAt      DateTime @default(now())

  @@index([brandId, usedForVoice])
  @@index([brandId, classification])
}

model VoiceReportRecord {
  id         String   @id @default(cuid())
  brandId    String
  brand      Brand    @relation(fields: [brandId], references: [id], onDelete: Cascade)
  reportJson Json
  createdAt  DateTime @default(now())
}

model SkillFile {
  id        String   @id @default(cuid())
  brandId   String
  brand     Brand    @relation(fields: [brandId], references: [id], onDelete: Cascade)
  version   String
  skillJson Json
  createdAt DateTime @default(now())

  @@index([brandId, createdAt])
}

model Generation {
  id          String     @id @default(cuid())
  brandId     String
  brand       Brand      @relation(fields: [brandId], references: [id], onDelete: Cascade)
  prompt      String
  tweetType   String
  outputText  String
  score       Int
  scoreLabel  String
  reason      String?
  issuesJson  Json?
  createdAt   DateTime   @default(now())

  feedback    Feedback[]
}

model Feedback {
  id           String     @id @default(cuid())
  generationId String
  generation   Generation @relation(fields: [generationId], references: [id], onDelete: Cascade)
  label        String
  comment      String?
  createdAt    DateTime   @default(now())
}

model AppSetting {
  key       String   @id
  valueJson Json
  updatedAt DateTime @updatedAt
}
```

- [ ] **Step 2: Create Prisma client singleton**

Create `lib/db.ts`:

```ts
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
```

- [ ] **Step 3: Create seed file**

Create `prisma/seed.ts`:

```ts
import { prisma } from "../lib/db";

async function main() {
  const count = await prisma.brand.count();
  if (count > 0) {
    return;
  }

  await prisma.brand.create({
    data: {
      name: "Example Founder Voice",
      twitterHandle: "@example",
      category: "Founder",
      audience: "builders, indie hackers, startup operators",
      description: "A sample workspace for testing the local MVP.",
      beliefs: "specific beats generic\nplain language beats hype",
      avoidSoundingLike: "corporate launch copy, vague AI hype",
    },
  });
}

main()
  .finally(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
```

- [ ] **Step 4: Generate and migrate**

Run:

```bash
npx prisma generate
npx prisma migrate dev --name init
```

Expected: Prisma client is generated and SQLite database is created at `prisma/dev.db` or the path in `DATABASE_URL`.

- [ ] **Step 5: Commit**

```bash
git add prisma lib/db.ts
git commit -m "feat: add Prisma schema"
```

## Task 3: Shared Types, Constants, and Request Helpers

**Files:**
- Create: `lib/types.ts`
- Create: `lib/constants.ts`
- Create: `lib/request.ts`
- Test: `tests/voice/types.test.ts`

- [ ] **Step 1: Write type smoke test**

Create `tests/voice/types.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { BANNED_AI_PHRASES, FEEDBACK_LABELS, TWEET_TYPES } from "@/lib/constants";

describe("shared constants", () => {
  it("includes the required banned phrases and feedback labels", () => {
    expect(BANNED_AI_PHRASES).toContain("game-changing");
    expect(BANNED_AI_PHRASES).toContain("we are excited to announce");
    expect(FEEDBACK_LABELS).toContain("Too generic");
    expect(TWEET_TYPES).toContain("contrarian take");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npm run test -- tests/voice/types.test.ts
```

Expected: FAIL because `lib/constants.ts` does not exist.

- [ ] **Step 3: Add shared types**

Create `lib/types.ts`:

```ts
export type TweetClassification =
  | "original"
  | "reply"
  | "quote"
  | "thread_candidate"
  | "link_only"
  | "retweet"
  | "too_short"
  | "noisy"
  | "useful";

export type ParsedTweet = {
  rawText: string;
  createdAt?: string;
  favoriteCount?: number;
  retweetCount?: number;
  replyToTweetId?: string;
  hashtags: string[];
  mentions: string[];
  urls: string[];
  language?: string;
  metadata: Record<string, unknown>;
};

export type CleanedTweet = {
  rawText: string;
  cleanedText: string;
};

export type ClassifiedTweet = ParsedTweet &
  CleanedTweet & {
    classification: TweetClassification;
    qualityScore: number;
    usedForVoice: boolean;
    duplicateKey: string;
  };

export type VoiceReport = {
  summary: string;
  personalityTraits: string[];
  toneSliders: {
    formalToCasual: number;
    seriousToFunny: number;
    respectfulToIrreverent: number;
    enthusiasticToMatterOfFact: number;
    simpleToComplex: number;
    warmToDetached: number;
  };
  linguisticMechanics: {
    averageTweetLength: number;
    sentenceLength: "short" | "medium" | "long" | "mixed";
    usesEmojis: boolean;
    emojiFrequency: "none" | "low" | "medium" | "high";
    punctuationStyle: string;
    capitalizationStyle: string;
    lineBreakStyle: string;
    firstPersonUsage: "low" | "medium" | "high";
    secondPersonUsage: "low" | "medium" | "high";
  };
  hookPatterns: string[];
  endingPatterns: string[];
  preferredPhrases: string[];
  avoidedPhrases: string[];
  contentPatterns: {
    name: string;
    description: string;
    structure: string;
  }[];
  exampleTweets: string[];
};

export type VoiceSkillFile = {
  version: string;
  brandName: string;
  voiceSummary: string;
  audience: string[];
  coreBeliefs: string[];
  coreVoiceIdentity: {
    traits: string[];
    thisNotThat: {
      this: string;
      notThat: string;
    }[];
  };
  toneSliders: VoiceReport["toneSliders"];
  linguisticRules: string[];
  contextualToneRules: {
    contentType: string;
    rules: string[];
  }[];
  preferredPhrases: string[];
  avoidedPhrases: string[];
  tweetPatterns: {
    name: string;
    structure: string;
    example?: string;
  }[];
  exampleLibrary: {
    onBrand: string[];
    offBrand: string[];
    approvedGenerated: string[];
    rejectedGenerated: string[];
  };
  qualityRubric: {
    brandVoiceMatch: number;
    twitterNativeness: number;
    specificity: number;
    hookQuality: number;
    nonGeneric: number;
    ctaFit: number;
  };
  updatedAt: string;
};

export type ProviderName = "mock" | "anthropic" | "openai" | "openrouter" | "openai-compatible";

export type LlmProviderConfig = {
  provider?: ProviderName;
  apiKey?: string;
  model?: string;
  baseUrl?: string;
};

export type GeneratedTweetResult = {
  text: string;
  score: number;
  scoreLabel: string;
  reason: string;
  issues: string[];
  suggestedRevisionDirection: string;
};
```

- [ ] **Step 4: Add constants and request helpers**

Create `lib/constants.ts`:

```ts
export const MAX_IMPORT_ITEMS = 5000;
export const MAX_ANALYSIS_SAMPLES = 200;

export const BANNED_AI_PHRASES = [
  "game-changing",
  "revolutionary",
  "unlock the future",
  "seamless",
  "in today's fast-paced world",
  "let's dive in",
  "supercharge",
  "cutting-edge",
  "we are excited to announce",
  "powerful solution",
  "transform the way",
];

export const TWEET_TYPES = [
  "single tweet",
  "thread",
  "founder opinion",
  "product update",
  "educational post",
  "contrarian take",
  "launch announcement",
  "soft CTA",
] as const;

export const FEEDBACK_LABELS = [
  "Sounds like us",
  "Too generic",
  "Too formal",
  "Too casual",
  "Too salesy",
  "Too polished",
  "Too long",
  "Too much hype",
  "Wrong vocabulary",
  "Good idea, wrong tone",
  "Good tone, weak hook",
] as const;
```

Create `lib/request.ts`:

```ts
import { NextResponse } from "next/server";
import type { LlmProviderConfig } from "@/lib/types";

export function jsonOk<T>(data: T, init?: ResponseInit) {
  return NextResponse.json(data, init);
}

export function jsonError(message: string, status = 400, details?: unknown) {
  return NextResponse.json({ error: message, details }, { status });
}

export function providerConfigFromBody(body: { providerConfig?: LlmProviderConfig }): LlmProviderConfig {
  const supplied = body.providerConfig ?? {};
  return {
    provider: supplied.provider,
    apiKey: supplied.apiKey,
    model: supplied.model,
    baseUrl: supplied.baseUrl,
  };
}
```

- [ ] **Step 5: Run tests**

Run:

```bash
npm run test -- tests/voice/types.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add lib/types.ts lib/constants.ts lib/request.ts tests/voice/types.test.ts
git commit -m "feat: add shared voice types"
```

## Task 4: Tweet Cleaning and Classification

**Files:**
- Create: `lib/tweets/cleanTweet.ts`
- Create: `lib/tweets/classifyTweet.ts`
- Test: `tests/tweets/cleanTweet.test.ts`
- Test: `tests/tweets/classifyTweet.test.ts`

- [ ] **Step 1: Write cleaning tests**

Create `tests/tweets/cleanTweet.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { cleanTweet } from "@/lib/tweets/cleanTweet";

describe("cleanTweet", () => {
  it("removes t.co URLs while preserving words", () => {
    expect(cleanTweet("Read this now https://t.co/abc123").cleanedText).toBe("Read this now");
  });

  it("normalizes whitespace and HTML entities", () => {
    expect(cleanTweet("Build&nbsp;in public &amp; learn\n\nfast").cleanedText).toBe("Build in public & learn fast");
  });
});
```

- [ ] **Step 2: Write classification tests**

Create `tests/tweets/classifyTweet.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { classifyTweets } from "@/lib/tweets/classifyTweet";
import type { ParsedTweet } from "@/lib/types";

function parsed(rawText: string): ParsedTweet {
  return {
    rawText,
    hashtags: [],
    mentions: [],
    urls: [],
    metadata: {},
  };
}

describe("classifyTweets", () => {
  it("excludes retweets", () => {
    const [tweet] = classifyTweets([parsed("RT @founder: this is a repost")]);
    expect(tweet.classification).toBe("retweet");
    expect(tweet.usedForVoice).toBe(false);
  });

  it("excludes link-only tweets", () => {
    const [tweet] = classifyTweets([parsed("https://example.com")]);
    expect(tweet.classification).toBe("link_only");
    expect(tweet.usedForVoice).toBe(false);
  });

  it("excludes too-short tweets", () => {
    const [tweet] = classifyTweets([parsed("tiny")]);
    expect(tweet.classification).toBe("too_short");
    expect(tweet.usedForVoice).toBe(false);
  });

  it("marks useful original tweets", () => {
    const [tweet] = classifyTweets([parsed("Specific examples beat vague advice because they give the reader something to copy.")]);
    expect(tweet.classification).toBe("useful");
    expect(tweet.usedForVoice).toBe(true);
    expect(tweet.qualityScore).toBeGreaterThanOrEqual(70);
  });

  it("marks duplicate tweets as noisy after the first instance", () => {
    const [first, second] = classifyTweets([
      parsed("Specific examples beat vague advice because they give the reader something to copy."),
      parsed("Specific examples beat vague advice because they give the reader something to copy."),
    ]);
    expect(first.usedForVoice).toBe(true);
    expect(second.classification).toBe("noisy");
    expect(second.usedForVoice).toBe(false);
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run:

```bash
npm run test -- tests/tweets/cleanTweet.test.ts tests/tweets/classifyTweet.test.ts
```

Expected: FAIL because tweet modules do not exist.

- [ ] **Step 4: Implement cleaning**

Create `lib/tweets/cleanTweet.ts`:

```ts
import type { CleanedTweet } from "@/lib/types";

const ENTITY_MAP: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": "\"",
  "&#39;": "'",
  "&nbsp;": " ",
};

export function cleanTweet(rawText: string): CleanedTweet {
  const decoded = Object.entries(ENTITY_MAP).reduce(
    (text, [entity, value]) => text.replaceAll(entity, value),
    rawText,
  );

  const withoutUrls = decoded.replace(/https?:\/\/\S+/gi, "").replace(/\bt\.co\/\S+/gi, "");
  const cleanedText = withoutUrls.replace(/\s+/g, " ").trim();

  return {
    rawText,
    cleanedText,
  };
}
```

- [ ] **Step 5: Implement classification**

Create `lib/tweets/classifyTweet.ts`:

```ts
import { BANNED_AI_PHRASES } from "@/lib/constants";
import type { ClassifiedTweet, ParsedTweet, TweetClassification } from "@/lib/types";
import { cleanTweet } from "@/lib/tweets/cleanTweet";

const GIVEAWAY_PATTERNS = [/giveaway/i, /follow.+retweet/i, /rt.+win/i, /winner announced/i];
const AUTOMATION_PATTERNS = [/posted automatically/i, /via buffer/i, /via zapier/i, /new blog post:/i];

function duplicateKey(text: string) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function isOnlyMentions(text: string) {
  return /^(@\w+\s*)+$/.test(text.trim());
}

function isOnlyHashtags(text: string) {
  return /^(#\w+\s*)+$/.test(text.trim());
}

function isPureUrl(text: string) {
  return /^(https?:\/\/\S+|\bt\.co\/\S+)\s*$/i.test(text.trim());
}

function classifySingle(tweet: ParsedTweet, cleanedText: string, seen: Set<string>): TweetClassification {
  const raw = tweet.rawText.trim();
  const key = duplicateKey(cleanedText);

  if (/^RT\s+@/i.test(raw)) return "retweet";
  if (isPureUrl(raw) || (cleanedText.length === 0 && /https?:\/\//i.test(raw))) return "link_only";
  if (cleanedText.length < 20) return "too_short";
  if (isOnlyMentions(raw) || isOnlyHashtags(raw)) return "noisy";
  if (GIVEAWAY_PATTERNS.some((pattern) => pattern.test(raw))) return "noisy";
  if (AUTOMATION_PATTERNS.some((pattern) => pattern.test(raw))) return "noisy";
  if (BANNED_AI_PHRASES.some((phrase) => cleanedText.toLowerCase().includes(phrase))) return "noisy";
  if (seen.has(key)) return "noisy";
  if (tweet.replyToTweetId || /^@\w+/.test(raw)) return "reply";
  if (/\bquote tweet\b/i.test(raw) || /\bQT\s*@/i.test(raw)) return "quote";
  if (/^\d+\/\d+/.test(raw) || /\bthread\b/i.test(raw)) return "thread_candidate";
  return "useful";
}

function scoreTweet(classification: TweetClassification, cleanedText: string, tweet: ParsedTweet) {
  if (classification !== "useful") {
    return classification === "reply" || classification === "quote" || classification === "thread_candidate" ? 55 : 20;
  }

  let score = 70;
  if (cleanedText.length > 80) score += 8;
  if (cleanedText.length > 160) score += 5;
  if (/[.!?]$/.test(cleanedText)) score += 4;
  if ((tweet.favoriteCount ?? 0) > 10) score += 5;
  if ((tweet.retweetCount ?? 0) > 3) score += 5;
  if (cleanedText.includes("\n")) score += 3;
  return Math.min(100, score);
}

export function classifyTweets(tweets: ParsedTweet[]): ClassifiedTweet[] {
  const seen = new Set<string>();

  return tweets.map((tweet) => {
    const cleaned = cleanTweet(tweet.rawText);
    const key = duplicateKey(cleaned.cleanedText);
    const classification = classifySingle(tweet, cleaned.cleanedText, seen);
    const usedForVoice = classification === "useful";

    if (usedForVoice) {
      seen.add(key);
    }

    return {
      ...tweet,
      ...cleaned,
      classification,
      qualityScore: scoreTweet(classification, cleaned.cleanedText, tweet),
      usedForVoice,
      duplicateKey: key,
    };
  });
}
```

- [ ] **Step 6: Run tests**

Run:

```bash
npm run test -- tests/tweets/cleanTweet.test.ts tests/tweets/classifyTweet.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add lib/tweets tests/tweets
git commit -m "feat: classify tweet samples"
```

## Task 5: Tweet Archive and Sample Parsing

**Files:**
- Create: `lib/tweets/parseTwitterArchive.ts`
- Test: `tests/tweets/parseTwitterArchive.test.ts`

- [ ] **Step 1: Write parser tests**

Create `tests/tweets/parseTwitterArchive.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { parseTweetTextContent, stripTwitterAssignment } from "@/lib/tweets/parseTwitterArchive";

describe("stripTwitterAssignment", () => {
  it("strips window.YTD assignment prefixes", () => {
    const input = "window.YTD.tweets.part0 = [{\"tweet\":{\"full_text\":\"hello\"}}]";
    expect(stripTwitterAssignment(input)).toBe("[{\"tweet\":{\"full_text\":\"hello\"}}]");
  });

  it("strips simple variable assignment prefixes", () => {
    const input = "var data = [{\"text\":\"hello\"}];";
    expect(stripTwitterAssignment(input)).toBe("[{\"text\":\"hello\"}]");
  });
});

describe("parseTweetTextContent", () => {
  it("parses Twitter archive JS", async () => {
    const parsed = await parseTweetTextContent("tweets.js", "window.YTD.tweets.part0 = [{\"tweet\":{\"full_text\":\"A real tweet sample with enough words\",\"created_at\":\"2024-01-01\",\"favorite_count\":\"4\",\"retweet_count\":\"2\",\"lang\":\"en\"}}]");
    expect(parsed.totalFound).toBe(1);
    expect(parsed.tweets[0].rawText).toBe("A real tweet sample with enough words");
    expect(parsed.tweets[0].favoriteCount).toBe(4);
  });

  it("parses JSON arrays", async () => {
    const parsed = await parseTweetTextContent("tweets.json", "[{\"text\":\"JSON tweet sample with useful context\"}]");
    expect(parsed.tweets[0].rawText).toBe("JSON tweet sample with useful context");
  });

  it("parses CSV with text column", async () => {
    const parsed = await parseTweetTextContent("tweets.csv", "text,created_at\n\"CSV tweet sample with useful context\",2024-01-01");
    expect(parsed.tweets[0].rawText).toBe("CSV tweet sample with useful context");
  });

  it("parses TXT by blank lines", async () => {
    const parsed = await parseTweetTextContent("tweets.txt", "First tweet sample with useful context\n\nSecond tweet sample with useful context");
    expect(parsed.tweets).toHaveLength(2);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
npm run test -- tests/tweets/parseTwitterArchive.test.ts
```

Expected: FAIL because parser module does not exist.

- [ ] **Step 3: Implement parser**

Create `lib/tweets/parseTwitterArchive.ts`:

```ts
import { parse } from "csv-parse/sync";
import JSZip from "jszip";
import { MAX_IMPORT_ITEMS } from "@/lib/constants";
import type { ParsedTweet } from "@/lib/types";

type ParseResult = {
  tweets: ParsedTweet[];
  totalFound: number;
};

export function stripTwitterAssignment(content: string) {
  const trimmed = content.trim().replace(/;$/, "");
  const assignmentIndex = trimmed.indexOf("=");
  if (assignmentIndex > -1 && trimmed.slice(0, assignmentIndex).match(/(window\.YTD|var\s+\w+|\w+)/)) {
    return trimmed.slice(assignmentIndex + 1).trim();
  }
  return trimmed;
}

function toNumber(value: unknown): number | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : undefined;
}

function extractEntities(source: Record<string, unknown>) {
  const entities = source.entities as Record<string, unknown> | undefined;
  const hashtags = Array.isArray(entities?.hashtags)
    ? entities.hashtags.map((item) => String((item as Record<string, unknown>).text ?? "")).filter(Boolean)
    : [];
  const mentions = Array.isArray(entities?.user_mentions)
    ? entities.user_mentions.map((item) => String((item as Record<string, unknown>).screen_name ?? "")).filter(Boolean)
    : [];
  const urls = Array.isArray(entities?.urls)
    ? entities.urls.map((item) => String((item as Record<string, unknown>).expanded_url ?? (item as Record<string, unknown>).url ?? "")).filter(Boolean)
    : [];

  return { hashtags, mentions, urls };
}

function normalizeTweetObject(item: unknown): ParsedTweet | null {
  const wrapper = item as Record<string, unknown>;
  const source = (wrapper.tweet && typeof wrapper.tweet === "object" ? wrapper.tweet : wrapper) as Record<string, unknown>;
  const rawText = String(source.full_text ?? source.text ?? source.tweet ?? source.content ?? "").trim();

  if (!rawText) return null;

  const entities = extractEntities(source);

  return {
    rawText,
    createdAt: source.created_at ? String(source.created_at) : undefined,
    favoriteCount: toNumber(source.favorite_count ?? source.favoriteCount ?? source.likes),
    retweetCount: toNumber(source.retweet_count ?? source.retweetCount ?? source.retweets),
    replyToTweetId: source.in_reply_to_status_id_str ? String(source.in_reply_to_status_id_str) : undefined,
    hashtags: entities.hashtags,
    mentions: entities.mentions,
    urls: entities.urls,
    language: source.lang ? String(source.lang) : undefined,
    metadata: source,
  };
}

function parseJsonLike(content: string): ParseResult {
  const json = JSON.parse(stripTwitterAssignment(content));
  const items = Array.isArray(json) ? json : Array.isArray(json.tweets) ? json.tweets : Array.isArray(json.data) ? json.data : [json];
  const normalized = items.map(normalizeTweetObject).filter((tweet): tweet is ParsedTweet => Boolean(tweet));
  return { tweets: normalized.slice(0, MAX_IMPORT_ITEMS), totalFound: normalized.length };
}

function parseCsv(content: string): ParseResult {
  const records = parse(content, { columns: true, skip_empty_lines: true, trim: true }) as Record<string, string>[];
  const normalized = records
    .map((record) =>
      normalizeTweetObject({
        text: record.text ?? record.tweet ?? record.full_text ?? record.content,
        created_at: record.created_at ?? record.date,
        favorite_count: record.favorite_count ?? record.likes,
        retweet_count: record.retweet_count ?? record.retweets,
        lang: record.lang ?? record.language,
      }),
    )
    .filter((tweet): tweet is ParsedTweet => Boolean(tweet));
  return { tweets: normalized.slice(0, MAX_IMPORT_ITEMS), totalFound: normalized.length };
}

function parseTxt(content: string): ParseResult {
  const chunks = content
    .split(/\n\s*\n/g)
    .flatMap((chunk) => (chunk.includes("\n\n") ? chunk.split(/\n\s*\n/g) : [chunk]))
    .map((chunk) => chunk.trim())
    .filter(Boolean);
  const fallback = chunks.length > 1 ? chunks : content.split(/\n/g).map((line) => line.trim()).filter(Boolean);
  const tweets = fallback.map((rawText) => ({
    rawText,
    hashtags: Array.from(rawText.matchAll(/#(\w+)/g)).map((match) => match[1]),
    mentions: Array.from(rawText.matchAll(/@(\w+)/g)).map((match) => match[1]),
    urls: Array.from(rawText.matchAll(/https?:\/\/\S+/g)).map((match) => match[0]),
    metadata: {},
  }));
  return { tweets: tweets.slice(0, MAX_IMPORT_ITEMS), totalFound: tweets.length };
}

export async function parseTweetTextContent(fileName: string, content: string): Promise<ParseResult> {
  const lowerName = fileName.toLowerCase();
  if (lowerName.endsWith(".csv")) return parseCsv(content);
  if (lowerName.endsWith(".txt")) return parseTxt(content);
  return parseJsonLike(content);
}

export async function parseTweetFile(fileName: string, bytes: ArrayBuffer): Promise<ParseResult> {
  if (fileName.toLowerCase().endsWith(".zip")) {
    const zip = await JSZip.loadAsync(bytes);
    const candidates = Object.values(zip.files).filter((file) => {
      const name = file.name.toLowerCase();
      return !file.dir && (name.endsWith("tweets.js") || name.includes("tweets") || name.endsWith(".json"));
    });

    const parsed: ParsedTweet[] = [];
    let totalFound = 0;

    for (const file of candidates) {
      const text = await file.async("string");
      const result = await parseTweetTextContent(file.name, text);
      totalFound += result.totalFound;
      parsed.push(...result.tweets);
      if (parsed.length >= MAX_IMPORT_ITEMS) break;
    }

    return { tweets: parsed.slice(0, MAX_IMPORT_ITEMS), totalFound };
  }

  const content = Buffer.from(bytes).toString("utf8");
  return parseTweetTextContent(fileName, content);
}
```

- [ ] **Step 4: Run tests**

Run:

```bash
npm run test -- tests/tweets/parseTwitterArchive.test.ts tests/tweets/cleanTweet.test.ts tests/tweets/classifyTweet.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/tweets/parseTwitterArchive.ts tests/tweets/parseTwitterArchive.test.ts
git commit -m "feat: parse tweet archive samples"
```

## Task 6: Voice Skill File, Evaluation, and Feedback Domain Logic

**Files:**
- Create: `lib/voice/versioning.ts`
- Create: `lib/voice/createSkillFile.ts`
- Create: `lib/voice/evaluateTweet.ts`
- Create: `lib/voice/updateSkillFileFromFeedback.ts`
- Test: `tests/voice/createSkillFile.test.ts`
- Test: `tests/voice/evaluateTweet.test.ts`
- Test: `tests/voice/updateSkillFileFromFeedback.test.ts`

- [ ] **Step 1: Write skill file creation test**

Create `tests/voice/createSkillFile.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { createVoiceSkillFile } from "@/lib/voice/createSkillFile";
import type { VoiceReport } from "@/lib/types";

const report: VoiceReport = {
  summary: "Direct, specific, builder-focused voice.",
  personalityTraits: ["direct", "practical"],
  toneSliders: {
    formalToCasual: 72,
    seriousToFunny: 35,
    respectfulToIrreverent: 30,
    enthusiasticToMatterOfFact: 65,
    simpleToComplex: 42,
    warmToDetached: 60,
  },
  linguisticMechanics: {
    averageTweetLength: 118,
    sentenceLength: "medium",
    usesEmojis: false,
    emojiFrequency: "none",
    punctuationStyle: "clean periods and occasional question marks",
    capitalizationStyle: "sentence case",
    lineBreakStyle: "short paragraphs",
    firstPersonUsage: "medium",
    secondPersonUsage: "medium",
  },
  hookPatterns: ["Start with a sharp claim"],
  endingPatterns: ["End with a practical takeaway"],
  preferredPhrases: ["specific beats generic"],
  avoidedPhrases: ["game-changing"],
  contentPatterns: [{ name: "Practical lesson", description: "Teaches from experience", structure: "claim -> example -> takeaway" }],
  exampleTweets: ["Specific examples beat vague advice because they give the reader something to copy."],
};

describe("createVoiceSkillFile", () => {
  it("builds the four-layer skill file from brand and report data", () => {
    const skill = createVoiceSkillFile({
      version: "v1.0",
      brand: {
        name: "Acme",
        audience: "founders, operators",
        beliefs: "specific beats generic\nshipping teaches faster than planning",
        avoidSoundingLike: "corporate launch copy",
      },
      report,
    });

    expect(skill.version).toBe("v1.0");
    expect(skill.brandName).toBe("Acme");
    expect(skill.coreBeliefs).toContain("specific beats generic");
    expect(skill.coreVoiceIdentity.thisNotThat[0]).toEqual({ this: "direct", notThat: "corporate launch copy" });
    expect(skill.exampleLibrary.onBrand).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Write evaluation and feedback tests**

Create `tests/voice/evaluateTweet.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { evaluateTweet, scoreLabel } from "@/lib/voice/evaluateTweet";
import type { VoiceSkillFile } from "@/lib/types";

const skill = {
  brandName: "Acme",
  voiceSummary: "Direct and practical",
  preferredPhrases: ["specific beats generic"],
  avoidedPhrases: ["game-changing"],
  qualityRubric: {
    brandVoiceMatch: 35,
    twitterNativeness: 20,
    specificity: 15,
    hookQuality: 10,
    nonGeneric: 10,
    ctaFit: 5,
  },
} as VoiceSkillFile;

describe("evaluateTweet", () => {
  it("labels scores using the required ranges", () => {
    expect(scoreLabel(95)).toBe("Very strong match");
    expect(scoreLabel(85)).toBe("Strong match");
    expect(scoreLabel(75)).toBe("Good match");
    expect(scoreLabel(65)).toBe("Weak match");
  });

  it("penalizes banned generic phrasing", () => {
    const result = evaluateTweet({
      tweet: "We are excited to announce a game-changing solution.",
      context: "launch",
      tweetType: "launch announcement",
      skillFile: skill,
    });

    expect(result.score).toBeLessThan(70);
    expect(result.issues).toContain("Uses avoided phrase: game-changing");
  });
});
```

Create `tests/voice/updateSkillFileFromFeedback.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { updateSkillFileFromFeedback } from "@/lib/voice/updateSkillFileFromFeedback";
import type { VoiceSkillFile } from "@/lib/types";

const baseSkill: VoiceSkillFile = {
  version: "v1.0",
  brandName: "Acme",
  voiceSummary: "Direct and practical",
  audience: [],
  coreBeliefs: [],
  coreVoiceIdentity: { traits: ["direct"], thisNotThat: [] },
  toneSliders: {
    formalToCasual: 70,
    seriousToFunny: 40,
    respectfulToIrreverent: 30,
    enthusiasticToMatterOfFact: 65,
    simpleToComplex: 35,
    warmToDetached: 55,
  },
  linguisticRules: [],
  contextualToneRules: [],
  preferredPhrases: [],
  avoidedPhrases: [],
  tweetPatterns: [],
  exampleLibrary: { onBrand: [], offBrand: [], approvedGenerated: [], rejectedGenerated: [] },
  qualityRubric: {
    brandVoiceMatch: 35,
    twitterNativeness: 20,
    specificity: 15,
    hookQuality: 10,
    nonGeneric: 10,
    ctaFit: 5,
  },
  updatedAt: "2026-04-25T00:00:00.000Z",
};

describe("updateSkillFileFromFeedback", () => {
  it("adds approved examples when feedback says sounds like us", () => {
    const updated = updateSkillFileFromFeedback({
      skillFile: baseSkill,
      nextVersion: "v1.1",
      generatedText: "Specific examples beat vague advice.",
      label: "Sounds like us",
    });

    expect(updated.version).toBe("v1.1");
    expect(updated.exampleLibrary.approvedGenerated).toContain("Specific examples beat vague advice.");
  });

  it("adds specificity rule when feedback says too generic", () => {
    const updated = updateSkillFileFromFeedback({
      skillFile: baseSkill,
      nextVersion: "v1.1",
      generatedText: "Build better products.",
      label: "Too generic",
    });

    expect(updated.linguisticRules).toContain("Prefer specific examples, concrete nouns, and sharper claims over broad advice.");
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run:

```bash
npm run test -- tests/voice/createSkillFile.test.ts tests/voice/evaluateTweet.test.ts tests/voice/updateSkillFileFromFeedback.test.ts
```

Expected: FAIL because voice modules do not exist.

- [ ] **Step 4: Implement version helper**

Create `lib/voice/versioning.ts`:

```ts
export function nextSkillVersion(currentVersion?: string | null) {
  if (!currentVersion) return "v1.0";
  const match = currentVersion.match(/^v(\d+)\.(\d+)$/);
  if (!match) return "v1.0";
  const major = Number(match[1]);
  const minor = Number(match[2]);
  return `v${major}.${minor + 1}`;
}
```

- [ ] **Step 5: Implement skill file creation**

Create `lib/voice/createSkillFile.ts`:

```ts
import { BANNED_AI_PHRASES, TWEET_TYPES } from "@/lib/constants";
import type { VoiceReport, VoiceSkillFile } from "@/lib/types";

type BrandInput = {
  name: string;
  audience?: string | null;
  beliefs?: string | null;
  avoidSoundingLike?: string | null;
};

function splitLines(value?: string | null) {
  return (value ?? "")
    .split(/\n|,/g)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function createVoiceSkillFile({
  version,
  brand,
  report,
}: {
  version: string;
  brand: BrandInput;
  report: VoiceReport;
}): VoiceSkillFile {
  const avoid = splitLines(brand.avoidSoundingLike);
  const firstAvoid = avoid[0] ?? "generic AI copy";

  return {
    version,
    brandName: brand.name,
    voiceSummary: report.summary,
    audience: splitLines(brand.audience),
    coreBeliefs: splitLines(brand.beliefs),
    coreVoiceIdentity: {
      traits: report.personalityTraits,
      thisNotThat: report.personalityTraits.slice(0, 5).map((trait) => ({
        this: trait,
        notThat: firstAvoid,
      })),
    },
    toneSliders: report.toneSliders,
    linguisticRules: [
      `Average tweet length should stay near ${report.linguisticMechanics.averageTweetLength} characters.`,
      `Sentence length tendency: ${report.linguisticMechanics.sentenceLength}.`,
      `Punctuation style: ${report.linguisticMechanics.punctuationStyle}.`,
      `Capitalization style: ${report.linguisticMechanics.capitalizationStyle}.`,
      `Line break style: ${report.linguisticMechanics.lineBreakStyle}.`,
      report.linguisticMechanics.usesEmojis ? `Emoji use is ${report.linguisticMechanics.emojiFrequency}.` : "Avoid emoji unless the context clearly benefits from one.",
    ],
    contextualToneRules: TWEET_TYPES.map((contentType) => ({
      contentType,
      rules: [
        "Stay grounded in the brand voice summary.",
        "Use concrete language and avoid generic AI phrasing.",
        "Do not invent metrics, customers, dates, or claims.",
      ],
    })),
    preferredPhrases: report.preferredPhrases,
    avoidedPhrases: Array.from(new Set([...report.avoidedPhrases, ...avoid, ...BANNED_AI_PHRASES])),
    tweetPatterns: report.contentPatterns.map((pattern) => ({
      name: pattern.name,
      structure: pattern.structure,
      example: report.exampleTweets[0],
    })),
    exampleLibrary: {
      onBrand: report.exampleTweets,
      offBrand: [],
      approvedGenerated: [],
      rejectedGenerated: [],
    },
    qualityRubric: {
      brandVoiceMatch: 35,
      twitterNativeness: 20,
      specificity: 15,
      hookQuality: 10,
      nonGeneric: 10,
      ctaFit: 5,
    },
    updatedAt: new Date().toISOString(),
  };
}
```

- [ ] **Step 6: Implement evaluation**

Create `lib/voice/evaluateTweet.ts`:

```ts
import { BANNED_AI_PHRASES } from "@/lib/constants";
import type { VoiceSkillFile } from "@/lib/types";

export function scoreLabel(score: number) {
  if (score >= 90) return "Very strong match";
  if (score >= 80) return "Strong match";
  if (score >= 70) return "Good match";
  return "Weak match";
}

function hasConcreteSignal(tweet: string) {
  return /\b\d+\b/.test(tweet) || /\b(customer|user|founder|team|repo|launch|archive|tweet|workflow|example|file)\b/i.test(tweet);
}

export function evaluateTweet({
  tweet,
  context,
  tweetType,
  skillFile,
}: {
  tweet: string;
  context: string;
  tweetType: string;
  skillFile: VoiceSkillFile;
}) {
  const lower = tweet.toLowerCase();
  const avoided = [...skillFile.avoidedPhrases, ...BANNED_AI_PHRASES];
  const issues: string[] = [];
  let score = 78;

  for (const phrase of avoided) {
    if (phrase && lower.includes(phrase.toLowerCase())) {
      score -= 12;
      issues.push(`Uses avoided phrase: ${phrase}`);
    }
  }

  if (tweet.length > 280 && tweetType !== "thread") {
    score -= 18;
    issues.push("Too long for a single tweet");
  }

  if (tweet.length < 35) {
    score -= 8;
    issues.push("Too short to carry a clear voice signal");
  }

  if (hasConcreteSignal(tweet)) {
    score += 8;
  } else {
    score -= 10;
    issues.push("Needs a more concrete noun, example, or claim");
  }

  if (/^i\b|^we\b|^you\b|^[A-Z][^.!?]+[.!?]/.test(tweet.trim())) {
    score += 5;
  } else {
    score -= 4;
    issues.push("Hook could be sharper");
  }

  if (context && tweet.toLowerCase().includes(context.split(/\s+/)[0]?.toLowerCase() ?? "")) {
    score += 4;
  }

  const bounded = Math.max(0, Math.min(100, score));

  return {
    score: bounded,
    scoreLabel: scoreLabel(bounded),
    reason: issues.length === 0 ? "Matches the skill file rules and stays specific." : "Needs revision against the skill file rules.",
    issues,
    suggestedRevisionDirection:
      issues.length === 0 ? "Keep the structure and preserve the concrete phrasing." : "Make it more specific, less polished, and closer to the approved examples.",
  };
}
```

- [ ] **Step 7: Implement feedback updates**

Create `lib/voice/updateSkillFileFromFeedback.ts`:

```ts
import type { VoiceSkillFile } from "@/lib/types";

function unique(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

export function updateSkillFileFromFeedback({
  skillFile,
  nextVersion,
  generatedText,
  label,
  comment,
}: {
  skillFile: VoiceSkillFile;
  nextVersion: string;
  generatedText: string;
  label: string;
  comment?: string | null;
}): VoiceSkillFile {
  const next: VoiceSkillFile = {
    ...skillFile,
    version: nextVersion,
    linguisticRules: [...skillFile.linguisticRules],
    preferredPhrases: [...skillFile.preferredPhrases],
    avoidedPhrases: [...skillFile.avoidedPhrases],
    exampleLibrary: {
      onBrand: [...skillFile.exampleLibrary.onBrand],
      offBrand: [...skillFile.exampleLibrary.offBrand],
      approvedGenerated: [...skillFile.exampleLibrary.approvedGenerated],
      rejectedGenerated: [...skillFile.exampleLibrary.rejectedGenerated],
    },
    updatedAt: new Date().toISOString(),
  };

  if (label === "Sounds like us") {
    next.exampleLibrary.approvedGenerated = unique([...next.exampleLibrary.approvedGenerated, generatedText]);
  }

  if (label === "Too generic") {
    next.linguisticRules.push("Prefer specific examples, concrete nouns, and sharper claims over broad advice.");
  }

  if (label === "Too polished") {
    next.linguisticRules.push("Avoid polished corporate announcement language.");
    next.avoidedPhrases.push("we are excited to announce", "seamless", "game-changing");
  }

  if (label === "Too formal") {
    next.linguisticRules.push("Use plainer, more conversational language without losing clarity.");
  }

  if (label === "Too casual") {
    next.linguisticRules.push("Preserve credibility and avoid throwaway casual phrasing.");
  }

  if (label === "Too salesy") {
    next.linguisticRules.push("Reduce promotional framing and lead with evidence, context, or a useful observation.");
  }

  if (label === "Too long") {
    next.linguisticRules.push("Compress drafts until every sentence earns its place.");
  }

  if (label === "Too much hype") {
    next.avoidedPhrases.push("revolutionary", "supercharge", "cutting-edge", "unlock the future");
  }

  if (label === "Wrong vocabulary" && comment) {
    next.avoidedPhrases.push(comment);
  }

  if (label === "Good idea, wrong tone") {
    next.exampleLibrary.rejectedGenerated = unique([...next.exampleLibrary.rejectedGenerated, generatedText]);
    next.linguisticRules.push("Keep the idea but revise tone toward the approved examples before using it.");
  }

  if (label === "Good tone, weak hook") {
    next.linguisticRules.push("Strengthen the first line with a sharper claim, contrast, or concrete setup.");
  }

  next.linguisticRules = unique(next.linguisticRules);
  next.avoidedPhrases = unique(next.avoidedPhrases);
  return next;
}
```

- [ ] **Step 8: Run tests**

Run:

```bash
npm run test -- tests/voice/createSkillFile.test.ts tests/voice/evaluateTweet.test.ts tests/voice/updateSkillFileFromFeedback.test.ts
```

Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add lib/voice tests/voice
git commit -m "feat: add skill file domain logic"
```

## Task 7: LLM Client, Prompts, Mock Analysis, and Mock Generation

**Files:**
- Create: `lib/llm/client.ts`
- Create: `lib/llm/mockProvider.ts`
- Create: `lib/llm/prompts/analyzeVoicePrompt.ts`
- Create: `lib/llm/prompts/generateTweetPrompt.ts`
- Create: `lib/llm/prompts/evaluateTweetPrompt.ts`
- Create: `lib/voice/analyzeVoice.ts`
- Create: `lib/voice/generateTweets.ts`
- Test: `tests/voice/analyzeVoice.test.ts`
- Test: `tests/voice/generateTweets.test.ts`

- [ ] **Step 1: Write mock workflow tests**

Create `tests/voice/analyzeVoice.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { analyzeVoice } from "@/lib/voice/analyzeVoice";

describe("analyzeVoice", () => {
  it("creates a heuristic report without provider credentials", async () => {
    const report = await analyzeVoice({
      brand: { name: "Acme", audience: "founders", beliefs: "specific beats generic" },
      samples: [
        { cleanedText: "Specific examples beat vague advice because readers can copy the move.", qualityScore: 90 },
        { cleanedText: "I trust sharp claims more when they include the tradeoff.", qualityScore: 85 },
      ],
      providerConfig: {},
    });

    expect(report.summary).toContain("Acme");
    expect(report.exampleTweets).toHaveLength(2);
    expect(report.linguisticMechanics.averageTweetLength).toBeGreaterThan(20);
  });
});
```

Create `tests/voice/generateTweets.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { generateTweets } from "@/lib/voice/generateTweets";
import type { VoiceSkillFile } from "@/lib/types";

const skillFile = {
  brandName: "Acme",
  voiceSummary: "Direct and practical",
  preferredPhrases: ["specific beats generic"],
  avoidedPhrases: ["game-changing"],
  exampleLibrary: {
    onBrand: ["Specific examples beat vague advice because readers can copy the move."],
    offBrand: [],
    approvedGenerated: [],
    rejectedGenerated: [],
  },
  linguisticRules: ["Use concrete language."],
} as VoiceSkillFile;

describe("generateTweets", () => {
  it("returns scored mock variations without provider credentials", async () => {
    const results = await generateTweets({
      context: "turning archive tweets into a reusable voice file",
      tweetType: "single tweet",
      variations: 3,
      notes: "",
      skillFile,
      examples: ["Specific examples beat vague advice because readers can copy the move."],
      providerConfig: {},
    });

    expect(results).toHaveLength(3);
    expect(results[0].text).toContain("voice file");
    expect(results[0].score).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
npm run test -- tests/voice/analyzeVoice.test.ts tests/voice/generateTweets.test.ts
```

Expected: FAIL because LLM and workflow modules do not exist.

- [ ] **Step 3: Add provider prompts**

Create `lib/llm/prompts/analyzeVoicePrompt.ts`:

```ts
import { BANNED_AI_PHRASES } from "@/lib/constants";

export function analyzeVoicePrompt({ brandName, samples }: { brandName: string; samples: string[] }) {
  return `Analyze the Twitter/X writing voice for ${brandName}.

Return only valid JSON matching the VoiceReport type. Do not include markdown.

Anti-slop rules:
- Do not call this a generic AI tweet generator.
- Avoid vague adjectives unless supported by examples.
- Identify mechanics from the samples, not from assumptions.
- Treat these as avoided phrases: ${BANNED_AI_PHRASES.join(", ")}.

Samples:
${samples.map((sample, index) => `${index + 1}. ${sample}`).join("\n")}`;
}
```

Create `lib/llm/prompts/generateTweetPrompt.ts`:

```ts
import { BANNED_AI_PHRASES } from "@/lib/constants";
import type { VoiceSkillFile } from "@/lib/types";

export function generateTweetPrompt({
  context,
  tweetType,
  variations,
  notes,
  skillFile,
  examples,
}: {
  context: string;
  tweetType: string;
  variations: number;
  notes?: string;
  skillFile: VoiceSkillFile;
  examples: string[];
}) {
  return `Generate ${variations} Twitter/X draft(s) in the brand voice.

Return only valid JSON in this shape:
{"tweets":[{"text":"tweet text","reason":"why it matches","issues":[],"suggestedRevisionDirection":"how to improve"}]}

Context:
${context}

Tweet type:
${tweetType}

Optional notes:
${notes || "none"}

Voice Skill File:
${JSON.stringify(skillFile, null, 2)}

Relevant examples:
${examples.map((example, index) => `${index + 1}. ${example}`).join("\n")}

Rules:
- Be Twitter-native: concise, specific, and natural.
- Do not use unnecessary hashtags.
- Do not invent metrics, customer names, dates, or claims.
- Do not sound corporate unless the skill file explicitly requires it.
- Avoid these phrases: ${BANNED_AI_PHRASES.join(", ")}.`;
}
```

Create `lib/llm/prompts/evaluateTweetPrompt.ts`:

```ts
export function evaluateTweetPrompt() {
  return "Evaluation is heuristic in Phase 1. This prompt file records the future evaluator boundary.";
}
```

- [ ] **Step 4: Add mock provider and client facade**

Create `lib/llm/mockProvider.ts`:

```ts
import type { GeneratedTweetResult, VoiceReport, VoiceSkillFile } from "@/lib/types";
import { evaluateTweet } from "@/lib/voice/evaluateTweet";

export function mockVoiceReport({
  brandName,
  samples,
}: {
  brandName: string;
  samples: string[];
}): VoiceReport {
  const averageTweetLength = Math.round(samples.reduce((sum, sample) => sum + sample.length, 0) / Math.max(samples.length, 1));
  const usesEmojis = samples.some((sample) => /[\u{1F300}-\u{1FAFF}]/u.test(sample));
  const questionCount = samples.filter((sample) => sample.includes("?")).length;

  return {
    summary: `${brandName} sounds direct, specific, and grounded in practical observations from its own writing samples.`,
    personalityTraits: ["direct", "practical", "specific", "clear"],
    toneSliders: {
      formalToCasual: 68,
      seriousToFunny: questionCount > 0 ? 45 : 32,
      respectfulToIrreverent: 28,
      enthusiasticToMatterOfFact: 64,
      simpleToComplex: 38,
      warmToDetached: 57,
    },
    linguisticMechanics: {
      averageTweetLength,
      sentenceLength: averageTweetLength < 90 ? "short" : averageTweetLength > 170 ? "long" : "medium",
      usesEmojis,
      emojiFrequency: usesEmojis ? "low" : "none",
      punctuationStyle: questionCount > 0 ? "periods with occasional questions" : "clean periods and short clauses",
      capitalizationStyle: "sentence case",
      lineBreakStyle: samples.some((sample) => sample.includes("\n")) ? "uses line breaks for emphasis" : "mostly single paragraph",
      firstPersonUsage: samples.some((sample) => /\bI\b|\bwe\b/i.test(sample)) ? "medium" : "low",
      secondPersonUsage: samples.some((sample) => /\byou\b/i.test(sample)) ? "medium" : "low",
    },
    hookPatterns: ["Start with a concrete claim", "Name the tradeoff before the advice"],
    endingPatterns: ["End with a practical takeaway", "Close without forced CTA language"],
    preferredPhrases: ["specific beats generic", "concrete examples"],
    avoidedPhrases: ["game-changing", "revolutionary", "we are excited to announce"],
    contentPatterns: [
      {
        name: "Claim with reason",
        description: "Makes a clear claim and immediately explains the practical reason.",
        structure: "claim -> because/reason -> takeaway",
      },
    ],
    exampleTweets: samples.slice(0, 5),
  };
}

export function mockGeneratedTweets({
  context,
  tweetType,
  variations,
  skillFile,
}: {
  context: string;
  tweetType: string;
  variations: number;
  skillFile: VoiceSkillFile;
}): GeneratedTweetResult[] {
  return Array.from({ length: variations }).map((_, index) => {
    const text =
      index === 0
        ? `${context} gets easier when the voice file is specific enough to reject generic drafts.`
        : `${skillFile.brandName} voice rule ${index + 1}: keep the tweet concrete, useful, and close to the source writing.`;
    const evaluation = evaluateTweet({ tweet: text, context, tweetType, skillFile });
    return {
      text,
      score: evaluation.score,
      scoreLabel: evaluation.scoreLabel,
      reason: evaluation.reason,
      issues: evaluation.issues,
      suggestedRevisionDirection: evaluation.suggestedRevisionDirection,
    };
  });
}
```

Create `lib/llm/client.ts` with provider request handling:

```ts
import type { LlmProviderConfig } from "@/lib/types";

type GenerateJsonInput = {
  providerConfig: LlmProviderConfig;
  prompt: string;
};

function envKey(provider?: string) {
  if (provider === "anthropic") return process.env.ANTHROPIC_API_KEY;
  if (provider === "openai") return process.env.OPENAI_API_KEY;
  if (provider === "openrouter") return process.env.OPENROUTER_API_KEY;
  if (provider === "openai-compatible") return process.env.OPENAI_COMPATIBLE_API_KEY;
  return undefined;
}

export function hasUsableProvider(config: LlmProviderConfig) {
  return Boolean(config.apiKey || envKey(config.provider));
}

export async function generateJsonWithLlm<T>({ providerConfig, prompt }: GenerateJsonInput): Promise<T> {
  const provider = providerConfig.provider ?? "mock";
  const apiKey = providerConfig.apiKey || envKey(provider);
  if (!apiKey || provider === "mock") {
    throw new Error("No usable LLM provider configured.");
  }

  if (provider === "anthropic") {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: providerConfig.model || "claude-3-5-sonnet-latest",
        max_tokens: 3000,
        messages: [{ role: "user", content: prompt }],
      }),
    });
    if (!response.ok) throw new Error(`Anthropic error ${response.status}: ${await response.text()}`);
    const json = await response.json();
    const text = json.content?.[0]?.text;
    return JSON.parse(text) as T;
  }

  const baseUrl =
    provider === "openrouter"
      ? "https://openrouter.ai/api/v1"
      : provider === "openai-compatible"
        ? providerConfig.baseUrl || process.env.OPENAI_COMPATIBLE_BASE_URL
        : "https://api.openai.com/v1";

  if (!baseUrl) {
    throw new Error("OpenAI-compatible provider requires a base URL.");
  }

  const response = await fetch(`${baseUrl.replace(/\/$/, "")}/chat/completions`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: providerConfig.model || (provider === "openrouter" ? "anthropic/claude-3.5-sonnet" : "gpt-4o-mini"),
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
    }),
  });
  if (!response.ok) throw new Error(`${provider} error ${response.status}: ${await response.text()}`);
  const json = await response.json();
  const text = json.choices?.[0]?.message?.content;
  return JSON.parse(text) as T;
}
```

- [ ] **Step 5: Implement analysis and generation workflows**

Create `lib/voice/analyzeVoice.ts`:

```ts
import { MAX_ANALYSIS_SAMPLES } from "@/lib/constants";
import { generateJsonWithLlm, hasUsableProvider } from "@/lib/llm/client";
import { mockVoiceReport } from "@/lib/llm/mockProvider";
import { analyzeVoicePrompt } from "@/lib/llm/prompts/analyzeVoicePrompt";
import type { LlmProviderConfig, VoiceReport } from "@/lib/types";

type BrandInput = {
  name: string;
  audience?: string | null;
  beliefs?: string | null;
};

type SampleInput = {
  cleanedText: string;
  qualityScore: number;
};

export async function analyzeVoice({
  brand,
  samples,
  providerConfig,
}: {
  brand: BrandInput;
  samples: SampleInput[];
  providerConfig: LlmProviderConfig;
}): Promise<VoiceReport> {
  const selected = samples
    .slice()
    .sort((a, b) => b.qualityScore - a.qualityScore)
    .slice(0, MAX_ANALYSIS_SAMPLES)
    .map((sample) => sample.cleanedText);

  if (hasUsableProvider(providerConfig)) {
    return generateJsonWithLlm<VoiceReport>({
      providerConfig,
      prompt: analyzeVoicePrompt({ brandName: brand.name, samples: selected }),
    });
  }

  return mockVoiceReport({ brandName: brand.name, samples: selected });
}
```

Create `lib/voice/generateTweets.ts`:

```ts
import { generateJsonWithLlm, hasUsableProvider } from "@/lib/llm/client";
import { mockGeneratedTweets } from "@/lib/llm/mockProvider";
import { generateTweetPrompt } from "@/lib/llm/prompts/generateTweetPrompt";
import type { GeneratedTweetResult, LlmProviderConfig, VoiceSkillFile } from "@/lib/types";
import { evaluateTweet } from "@/lib/voice/evaluateTweet";

export async function generateTweets({
  context,
  tweetType,
  variations,
  notes,
  skillFile,
  examples,
  providerConfig,
}: {
  context: string;
  tweetType: string;
  variations: number;
  notes?: string;
  skillFile: VoiceSkillFile;
  examples: string[];
  providerConfig: LlmProviderConfig;
}): Promise<GeneratedTweetResult[]> {
  const count = Math.max(1, Math.min(10, variations));

  if (!hasUsableProvider(providerConfig)) {
    return mockGeneratedTweets({ context, tweetType, variations: count, skillFile });
  }

  const response = await generateJsonWithLlm<{ tweets: Omit<GeneratedTweetResult, "score" | "scoreLabel">[] }>({
    providerConfig,
    prompt: generateTweetPrompt({ context, tweetType, variations: count, notes, skillFile, examples }),
  });

  return response.tweets.slice(0, count).map((tweet) => {
    const evaluation = evaluateTweet({ tweet: tweet.text, context, tweetType, skillFile });
    return {
      text: tweet.text,
      score: evaluation.score,
      scoreLabel: evaluation.scoreLabel,
      reason: tweet.reason || evaluation.reason,
      issues: Array.from(new Set([...(tweet.issues || []), ...evaluation.issues])),
      suggestedRevisionDirection: tweet.suggestedRevisionDirection || evaluation.suggestedRevisionDirection,
    };
  });
}
```

- [ ] **Step 6: Run tests**

Run:

```bash
npm run test -- tests/voice/analyzeVoice.test.ts tests/voice/generateTweets.test.ts tests/voice/evaluateTweet.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add lib/llm lib/voice/analyzeVoice.ts lib/voice/generateTweets.ts tests/voice/analyzeVoice.test.ts tests/voice/generateTweets.test.ts
git commit -m "feat: add provider backed voice workflows"
```

## Task 8: API Routes

**Files:**
- Create: `app/api/brands/route.ts`
- Create: `app/api/brands/[brandId]/route.ts`
- Create: `app/api/brands/[brandId]/uploads/route.ts`
- Create: `app/api/brands/[brandId]/analyze/route.ts`
- Create: `app/api/brands/[brandId]/skill-file/route.ts`
- Create: `app/api/brands/[brandId]/generate/route.ts`
- Create: `app/api/generations/[generationId]/feedback/route.ts`

- [ ] **Step 1: Add brand routes**

Create `app/api/brands/route.ts`:

```ts
import { prisma } from "@/lib/db";
import { jsonError, jsonOk } from "@/lib/request";

export async function GET() {
  const brands = await prisma.brand.findMany({
    orderBy: { updatedAt: "desc" },
    include: {
      _count: { select: { contentSamples: true, skillFiles: true } },
    },
  });
  return jsonOk({ brands });
}

export async function POST(request: Request) {
  const body = await request.json();
  if (!body.name || typeof body.name !== "string") {
    return jsonError("Brand name is required.", 400);
  }

  const brand = await prisma.brand.create({
    data: {
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
}
```

Create `app/api/brands/[brandId]/route.ts`:

```ts
import { prisma } from "@/lib/db";
import { jsonError, jsonOk } from "@/lib/request";

export async function GET(_request: Request, { params }: { params: Promise<{ brandId: string }> }) {
  const { brandId } = await params;
  const brand = await prisma.brand.findUnique({
    where: { id: brandId },
    include: {
      uploads: { orderBy: { createdAt: "desc" }, take: 5 },
      voiceReports: { orderBy: { createdAt: "desc" }, take: 1 },
      skillFiles: { orderBy: { createdAt: "desc" }, take: 1 },
      _count: { select: { contentSamples: true, generations: true } },
    },
  });

  if (!brand) return jsonError("Brand not found.", 404);
  return jsonOk({ brand });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ brandId: string }> }) {
  const { brandId } = await params;
  const body = await request.json();
  const brand = await prisma.brand.update({
    where: { id: brandId },
    data: {
      name: body.name,
      twitterHandle: body.twitterHandle,
      website: body.website,
      category: body.category,
      audience: body.audience,
      description: body.description,
      beliefs: body.beliefs,
      avoidSoundingLike: body.avoidSoundingLike,
    },
  });
  return jsonOk({ brand });
}
```

- [ ] **Step 2: Add upload route**

Create `app/api/brands/[brandId]/uploads/route.ts`:

```ts
import { prisma } from "@/lib/db";
import { jsonError, jsonOk } from "@/lib/request";
import { classifyTweets } from "@/lib/tweets/classifyTweet";
import { parseTweetFile } from "@/lib/tweets/parseTwitterArchive";

export async function POST(request: Request, { params }: { params: Promise<{ brandId: string }> }) {
  const { brandId } = await params;
  const brand = await prisma.brand.findUnique({ where: { id: brandId } });
  if (!brand) return jsonError("Brand not found.", 404);

  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return jsonError("Upload file is required.", 400);

  const upload = await prisma.upload.create({
    data: {
      brandId,
      fileName: file.name,
      fileType: file.type || file.name.split(".").pop() || "unknown",
      status: "processing",
    },
  });

  try {
    const parsed = await parseTweetFile(file.name, await file.arrayBuffer());
    const classified = classifyTweets(parsed.tweets);
    const counts = classified.reduce<Record<string, number>>((acc, tweet) => {
      acc[tweet.classification] = (acc[tweet.classification] ?? 0) + 1;
      return acc;
    }, {});
    const usefulItems = classified.filter((tweet) => tweet.usedForVoice).length;
    const excludedItems = classified.length - usefulItems;
    const summary = {
      totalFound: parsed.totalFound,
      imported: classified.length,
      usefulItems,
      excludedItems,
      counts,
      usefulPreview: classified.filter((tweet) => tweet.usedForVoice).slice(0, 20).map((tweet) => tweet.cleanedText),
    };

    await prisma.contentSample.createMany({
      data: classified.map((tweet) => ({
        brandId,
        uploadId: upload.id,
        rawText: tweet.rawText,
        cleanedText: tweet.cleanedText,
        sourceType: "twitter_archive",
        classification: tweet.classification,
        qualityScore: tweet.qualityScore,
        usedForVoice: tweet.usedForVoice,
        metadataJson: {
          createdAt: tweet.createdAt,
          favoriteCount: tweet.favoriteCount,
          retweetCount: tweet.retweetCount,
          hashtags: tweet.hashtags,
          mentions: tweet.mentions,
          urls: tweet.urls,
          language: tweet.language,
        },
      })),
    });

    const updatedUpload = await prisma.upload.update({
      where: { id: upload.id },
      data: {
        status: "completed",
        totalItems: parsed.totalFound,
        usefulItems,
        excludedItems,
        summaryJson: summary,
      },
    });

    return jsonOk({ upload: updatedUpload, summary });
  } catch (error) {
    await prisma.upload.update({
      where: { id: upload.id },
      data: { status: "failed", summaryJson: { error: error instanceof Error ? error.message : "Unknown parse error" } },
    });
    return jsonError(error instanceof Error ? error.message : "Could not parse upload.", 400);
  }
}
```

- [ ] **Step 3: Add analysis, skill file, generation, and feedback routes**

Create `app/api/brands/[brandId]/analyze/route.ts`:

```ts
import { MAX_ANALYSIS_SAMPLES } from "@/lib/constants";
import { prisma } from "@/lib/db";
import { providerConfigFromBody, jsonError, jsonOk } from "@/lib/request";
import { analyzeVoice } from "@/lib/voice/analyzeVoice";
import { createVoiceSkillFile } from "@/lib/voice/createSkillFile";

export async function POST(request: Request, { params }: { params: Promise<{ brandId: string }> }) {
  const { brandId } = await params;
  const brand = await prisma.brand.findUnique({ where: { id: brandId } });
  if (!brand) return jsonError("Brand not found.", 404);

  const samples = await prisma.contentSample.findMany({
    where: { brandId, usedForVoice: true },
    orderBy: { qualityScore: "desc" },
    take: MAX_ANALYSIS_SAMPLES,
    select: { cleanedText: true, qualityScore: true },
  });

  if (samples.length === 0) {
    return jsonError("Upload useful writing samples before analyzing voice.", 400);
  }

  const body = await request.json().catch(() => ({}));
  const report = await analyzeVoice({
    brand,
    samples,
    providerConfig: providerConfigFromBody(body),
  });

  await prisma.voiceReportRecord.create({
    data: { brandId, reportJson: report },
  });

  const existingSkillFile = await prisma.skillFile.findFirst({
    where: { brandId },
    orderBy: { createdAt: "desc" },
  });

  const skillFile =
    existingSkillFile ??
    (await prisma.skillFile.create({
      data: {
        brandId,
        version: "v1.0",
        skillJson: createVoiceSkillFile({ version: "v1.0", brand, report }),
      },
    }));

  return jsonOk({ report, skillFile });
}
```

Create `app/api/brands/[brandId]/skill-file/route.ts`:

```ts
import { prisma } from "@/lib/db";
import { jsonError, jsonOk } from "@/lib/request";
import type { VoiceSkillFile } from "@/lib/types";
import { nextSkillVersion } from "@/lib/voice/versioning";

function hasRequiredSkillShape(value: unknown): value is VoiceSkillFile {
  if (!value || typeof value !== "object") return false;
  const skill = value as Record<string, unknown>;
  return Boolean(
    skill.brandName &&
      skill.voiceSummary &&
      skill.coreVoiceIdentity &&
      skill.toneSliders &&
      Array.isArray(skill.linguisticRules) &&
      Array.isArray(skill.contextualToneRules) &&
      skill.exampleLibrary &&
      skill.qualityRubric,
  );
}

export async function GET(_request: Request, { params }: { params: Promise<{ brandId: string }> }) {
  const { brandId } = await params;
  const skillFile = await prisma.skillFile.findFirst({
    where: { brandId },
    orderBy: { createdAt: "desc" },
  });
  if (!skillFile) return jsonError("Skill file not found.", 404);
  return jsonOk({ skillFile });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ brandId: string }> }) {
  const { brandId } = await params;
  const body = await request.json();
  const incoming = body.skillJson;

  if (!hasRequiredSkillShape(incoming)) {
    return jsonError("Skill file JSON is missing required top-level fields.", 400);
  }

  const latest = await prisma.skillFile.findFirst({
    where: { brandId },
    orderBy: { createdAt: "desc" },
  });

  const version = nextSkillVersion(latest?.version);
  const skillJson: VoiceSkillFile = {
    ...incoming,
    version,
    updatedAt: new Date().toISOString(),
  };

  const skillFile = await prisma.skillFile.create({
    data: { brandId, version, skillJson },
  });

  return jsonOk({ skillFile });
}
```

Create `app/api/brands/[brandId]/generate/route.ts`:

```ts
import { prisma } from "@/lib/db";
import { providerConfigFromBody, jsonError, jsonOk } from "@/lib/request";
import type { VoiceSkillFile } from "@/lib/types";
import { generateTweets } from "@/lib/voice/generateTweets";

export async function POST(request: Request, { params }: { params: Promise<{ brandId: string }> }) {
  const { brandId } = await params;
  const body = await request.json();

  if (!body.context || typeof body.context !== "string") {
    return jsonError("Generation context is required.", 400);
  }

  const latestSkillFile = await prisma.skillFile.findFirst({
    where: { brandId },
    orderBy: { createdAt: "desc" },
  });

  if (!latestSkillFile) {
    return jsonError("Analyze voice and create a skill file before generating tweets.", 400);
  }

  const samples = await prisma.contentSample.findMany({
    where: { brandId, usedForVoice: true },
    orderBy: { qualityScore: "desc" },
    take: 12,
    select: { cleanedText: true },
  });

  const skillFile = latestSkillFile.skillJson as VoiceSkillFile;
  const results = await generateTweets({
    context: body.context,
    tweetType: body.tweetType || "single tweet",
    variations: Number(body.variations || 3),
    notes: body.notes || "",
    skillFile,
    examples: samples.map((sample) => sample.cleanedText),
    providerConfig: providerConfigFromBody(body),
  });

  const generations = await Promise.all(
    results.map((result) =>
      prisma.generation.create({
        data: {
          brandId,
          prompt: body.context,
          tweetType: body.tweetType || "single tweet",
          outputText: result.text,
          score: result.score,
          scoreLabel: result.scoreLabel,
          reason: result.reason,
          issuesJson: {
            issues: result.issues,
            suggestedRevisionDirection: result.suggestedRevisionDirection,
          },
        },
      }),
    ),
  );

  return jsonOk({ generations });
}
```

Create `app/api/generations/[generationId]/feedback/route.ts`:

```ts
import { FEEDBACK_LABELS } from "@/lib/constants";
import { prisma } from "@/lib/db";
import { jsonError, jsonOk } from "@/lib/request";
import type { VoiceSkillFile } from "@/lib/types";
import { updateSkillFileFromFeedback } from "@/lib/voice/updateSkillFileFromFeedback";
import { nextSkillVersion } from "@/lib/voice/versioning";

export async function POST(request: Request, { params }: { params: Promise<{ generationId: string }> }) {
  const { generationId } = await params;
  const body = await request.json();

  if (!FEEDBACK_LABELS.includes(body.label)) {
    return jsonError("Feedback label is not supported.", 400);
  }

  const generation = await prisma.generation.findUnique({
    where: { id: generationId },
  });

  if (!generation) return jsonError("Generation not found.", 404);

  const latestSkillFile = await prisma.skillFile.findFirst({
    where: { brandId: generation.brandId },
    orderBy: { createdAt: "desc" },
  });

  if (!latestSkillFile) return jsonError("Skill file not found.", 404);

  const feedback = await prisma.feedback.create({
    data: {
      generationId,
      label: body.label,
      comment: body.comment || null,
    },
  });

  const version = nextSkillVersion(latestSkillFile.version);
  const updated = updateSkillFileFromFeedback({
    skillFile: latestSkillFile.skillJson as VoiceSkillFile,
    nextVersion: version,
    generatedText: generation.outputText,
    label: body.label,
    comment: body.comment || null,
  });

  const skillFile = await prisma.skillFile.create({
    data: {
      brandId: generation.brandId,
      version,
      skillJson: updated,
    },
  });

  return jsonOk({ feedback, skillFile });
}
```

- [ ] **Step 4: Type-check and build**

Run:

```bash
npm run build
```

Expected: routes compile successfully.

- [ ] **Step 5: Commit**

```bash
git add app/api
git commit -m "feat: add MVP API routes"
```

## Task 9: Brand Workspace UI

**Files:**
- Modify: `app/page.tsx`
- Create: `components/brands/BrandForm.tsx`
- Create: `app/brands/new/page.tsx`
- Create: `app/brands/[brandId]/page.tsx`

- [ ] **Step 1: Implement brand creation form**

Create `components/brands/BrandForm.tsx` with a client component that collects `name`, `twitterHandle`, `website`, `category`, `audience`, `description`, `beliefs`, and `avoidSoundingLike`, posts to `/api/brands`, and redirects to `/brands/${brand.id}` on success.

Use this field pattern for every input:

```tsx
<label className="space-y-1">
  <span className="text-sm font-medium text-ink">Brand name</span>
  <input
    name="name"
    required
    className="w-full rounded-ui border border-line px-3 py-2 text-sm"
    placeholder="Acme"
  />
</label>
```

Use this submit handler:

```tsx
async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
  event.preventDefault();
  setError("");
  setLoading(true);
  const formData = new FormData(event.currentTarget);
  const payload = Object.fromEntries(formData.entries());
  const response = await fetch("/api/brands", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  const json = await response.json();
  setLoading(false);
  if (!response.ok) {
    setError(json.error || "Could not create brand.");
    return;
  }
  router.push(`/brands/${json.brand.id}`);
}
```

- [ ] **Step 2: Add brand pages**

Create `app/brands/new/page.tsx`:

```tsx
import { BrandForm } from "@/components/brands/BrandForm";

export default function NewBrandPage() {
  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-3xl font-semibold text-ink">Create Brand Voice Workspace</h1>
        <p className="mt-2 text-sm text-muted">Capture the context the voice file should preserve.</p>
      </div>
      <BrandForm />
    </div>
  );
}
```

Modify `app/page.tsx` to fetch brands from Prisma and list workspace cards with links to `/brands/[brandId]`.

Create `app/brands/[brandId]/page.tsx` to fetch the brand, counts for useful samples, latest upload, latest skill file, and render action links:

```tsx
const actions = [
  { href: `/brands/${brand.id}/upload`, label: "Upload Content" },
  { href: `/brands/${brand.id}/voice-report`, label: "Analyze Voice" },
  { href: `/brands/${brand.id}/skill-file`, label: "View Skill File" },
  { href: `/brands/${brand.id}/studio`, label: "Open Tweet Studio" },
];
```

- [ ] **Step 3: Build check**

Run:

```bash
npm run build
```

Expected: brand pages compile.

- [ ] **Step 4: Commit**

```bash
git add app/page.tsx app/brands components/brands
git commit -m "feat: add brand workspace UI"
```

## Task 10: Upload UI and Summary

**Files:**
- Create: `components/uploads/UploadForm.tsx`
- Create: `app/brands/[brandId]/upload/page.tsx`

- [ ] **Step 1: Create upload client form**

Create `components/uploads/UploadForm.tsx` with a file input accepting `.zip,.js,.json,.csv,.txt`, posting `FormData` to `/api/brands/${brandId}/uploads`, and rendering:

- total found
- imported count
- useful count
- excluded count
- classification counts
- first 20 useful samples

Use this upload handler:

```tsx
async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
  event.preventDefault();
  setError("");
  setSummary(null);
  setLoading(true);
  const formData = new FormData(event.currentTarget);
  const response = await fetch(`/api/brands/${brandId}/uploads`, { method: "POST", body: formData });
  const json = await response.json();
  setLoading(false);
  if (!response.ok) {
    setError(json.error || "Could not upload file.");
    return;
  }
  setSummary(json.summary);
}
```

- [ ] **Step 2: Create upload page**

Create `app/brands/[brandId]/upload/page.tsx` as a server page that verifies the brand exists, shows the upload form, and lists recent uploads with status and useful item counts.

- [ ] **Step 3: Manual upload check**

Create a local sample file outside the repo:

```bash
cat > /tmp/voice-sample-tweets.js <<'SAMPLE'
window.YTD.tweets.part0 = [{"tweet":{"full_text":"Specific examples beat vague advice because they give the reader something to copy.","created_at":"2024-01-01","favorite_count":"3","retweet_count":"1","lang":"en"}},{"tweet":{"full_text":"RT @someone: not original","created_at":"2024-01-02"}}]
SAMPLE
```

Run the dev server:

```bash
npm run dev
```

Expected: uploading `/tmp/voice-sample-tweets.js` shows one useful sample and one retweet.

- [ ] **Step 4: Commit**

```bash
git add components/uploads app/brands/[brandId]/upload
git commit -m "feat: add upload center UI"
```

## Task 11: Settings, Voice Report, and Skill File UI

**Files:**
- Create: `components/settings/ProviderSettingsForm.tsx`
- Create: `app/settings/page.tsx`
- Create: `app/brands/[brandId]/voice-report/page.tsx`
- Create: `components/skill-file/SkillFileEditor.tsx`
- Create: `app/brands/[brandId]/skill-file/page.tsx`

- [ ] **Step 1: Create BYOK settings form**

Create `components/settings/ProviderSettingsForm.tsx` with localStorage key `voice-skill-file-provider-config`. Fields:

- provider select: `mock`, `anthropic`, `openai`, `openrouter`, `openai-compatible`
- model input
- base URL input
- API key password input

Expose this helper in the component file:

```ts
export const PROVIDER_STORAGE_KEY = "voice-skill-file-provider-config";
```

Create `app/settings/page.tsx` to render it with copy that says API keys stay in this browser's localStorage and are not saved to SQLite.

- [ ] **Step 2: Create voice report page**

Create `app/brands/[brandId]/voice-report/page.tsx` with:

- latest report display if present
- button that posts to `/api/brands/${brandId}/analyze`
- client script reads provider config from localStorage and includes it in the JSON body
- report sections: Summary, Tone sliders, Linguistic mechanics, Hook patterns, Ending patterns, Preferred phrases, Avoided phrases, Example tweets

- [ ] **Step 3: Create skill file editor**

Create `components/skill-file/SkillFileEditor.tsx` with a textarea containing pretty JSON. On save, parse JSON client-side first. If parse succeeds, send:

```ts
await fetch(`/api/brands/${brandId}/skill-file`, {
  method: "PATCH",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ skillJson: parsed }),
});
```

Create `app/brands/[brandId]/skill-file/page.tsx` to fetch latest skill file and render the editor. If no file exists, link to voice report.

- [ ] **Step 4: Build check**

Run:

```bash
npm run build
```

Expected: settings, report, and skill file pages compile.

- [ ] **Step 5: Commit**

```bash
git add app/settings components/settings app/brands/[brandId]/voice-report app/brands/[brandId]/skill-file components/skill-file
git commit -m "feat: add voice report and skill file UI"
```

## Task 12: Tweet Studio and Feedback UI

**Files:**
- Create: `components/studio/TweetStudio.tsx`
- Create: `components/studio/FeedbackButtons.tsx`
- Create: `app/brands/[brandId]/studio/page.tsx`

- [ ] **Step 1: Create Tweet Studio component**

Create `components/studio/TweetStudio.tsx` as a client component with fields:

- textarea `context`
- select `tweetType` from `TWEET_TYPES`
- number input `variations`, min 1, max 10
- textarea `notes`

On submit, read provider config from localStorage, post to `/api/brands/${brandId}/generate`, and render tweet cards with output text, score, label, reason, issues, and suggested revision direction.

- [ ] **Step 2: Create feedback component**

Create `components/studio/FeedbackButtons.tsx` that renders all `FEEDBACK_LABELS`, an optional comment box, and posts:

```ts
await fetch(`/api/generations/${generationId}/feedback`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ label, comment }),
});
```

After success, show the new skill file version returned by the API.

- [ ] **Step 3: Create studio page**

Create `app/brands/[brandId]/studio/page.tsx` to fetch brand and latest skill file. If no skill file exists, show a link to analyze voice. If a skill file exists, render `TweetStudio`.

- [ ] **Step 4: Manual studio check**

Run:

```bash
npm run dev
```

Expected local flow:

1. Create a brand.
2. Upload `/tmp/voice-sample-tweets.js`.
3. Analyze voice without provider settings and get a mock report.
4. Open studio.
5. Generate three variations.
6. Click "Too generic" on one generation.
7. The feedback response shows skill file version `v1.1`.

- [ ] **Step 5: Commit**

```bash
git add app/brands/[brandId]/studio components/studio
git commit -m "feat: add tweet studio feedback loop"
```

## Task 13: Full Verification and Polish

**Files:**
- Modify: `app/globals.css`
- Modify: pages and components touched in prior tasks only when verification exposes fit, copy, or state issues.

- [ ] **Step 1: Run full automated checks**

Run:

```bash
npm run test
npm run build
```

Expected: all tests pass and production build succeeds.

- [ ] **Step 2: Verify no out-of-scope features exist**

Run:

```bash
rg -n "OAuth|schedule|scheduler|analytics|competitor|trend|billing|subscription|LinkedIn|Instagram|post to Twitter|tweet posting" app components lib
```

Expected: no product implementation of out-of-scope features. Mentions in negative copy are acceptable only if they clarify the MVP does not do those things.

- [ ] **Step 3: Run local end-to-end smoke test**

Run:

```bash
npm run dev
```

Use the browser to complete:

1. `/settings`: save provider as `mock`.
2. `/brands/new`: create a brand.
3. `/brands/[brandId]/upload`: upload sample file.
4. `/brands/[brandId]/voice-report`: analyze voice.
5. `/brands/[brandId]/skill-file`: edit JSON and save.
6. `/brands/[brandId]/studio`: generate tweets.
7. Submit feedback and confirm a new skill file version appears.

Expected: every acceptance criterion from the design spec is observable in the local app.

- [ ] **Step 4: Commit verification fixes**

If Step 1, 2, or 3 required code changes:

```bash
git add app components lib tests prisma package.json package-lock.json
git commit -m "fix: complete MVP verification"
```

If no code changes were required, do not create an empty commit.

## Self-Review Checklist

- Spec coverage: Tasks cover app scaffold, Prisma schema, tweet parsing, cleaning, filtering, voice analysis, skill file creation, JSON editing, BYOK settings, generation, scoring, feedback updates, and final verification.
- Placeholder scan: This plan contains concrete file paths, commands, route handler code, data shapes, and code snippets. Implementation steps that create code name the exact files and interfaces.
- Type consistency: `VoiceReport`, `VoiceSkillFile`, `LlmProviderConfig`, `GeneratedTweetResult`, feedback labels, tweet types, and version helpers are used consistently across tasks.
