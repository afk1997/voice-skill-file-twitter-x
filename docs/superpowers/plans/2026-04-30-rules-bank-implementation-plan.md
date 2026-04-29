# Rules Bank Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a full rules bank with starter rules, custom reusable rules, brand selections, preview, apply, and Skill File version hardening.

**Architecture:** Add persistent rule-bank models beside the existing versioned Skill File system. Keep rule compilation pure in `lib/rules`, expose it through small API routes, and use the existing Skill File JSON fields as the generation-ready output. The brand rules page is the main work surface; the global rules page manages reusable rules.

**Tech Stack:** Next.js App Router, React client components, Prisma/Postgres, TypeScript, Vitest, Tailwind, lucide-react.

---

## Scope Check

This plan implements one connected feature from the approved spec: rules bank to Skill File hardening. It spans database, compiler, API, and UI, but the pieces are not independently useful without the full preview/apply path, so one plan is appropriate.

## File Structure

Create:

- `lib/rules/types.ts`: app-facing rule constants, payload types, validation helpers, and Prisma enum mapping helpers.
- `lib/rules/starterRules.ts`: curated starter rules derived from the writing ruleset.
- `lib/rules/seedStarterRules.ts`: idempotent starter-rule upsert helper.
- `lib/rules/compileRulesToSkillPatch.ts`: pure compiler from selected rules to next Skill File JSON and preview patch.
- `lib/rules/ruleBankService.ts`: database orchestration for listing, creating, selecting, previewing, and applying rules.
- `components/rules/RuleForm.tsx`: client form for creating custom rules.
- `components/rules/RuleList.tsx`: client list/filter/select surface for rules.
- `components/rules/BrandRulesClient.tsx`: brand rules page client orchestration.
- `components/rules/GlobalRulesClient.tsx`: global rules page client orchestration.
- `app/rules/page.tsx`: global rules page.
- `app/api/rules/route.ts`: list/create global custom rules.
- `app/api/rules/[ruleId]/route.ts`: edit global custom rules.
- `app/brands/[brandId]/rules/page.tsx`: brand rules page.
- `app/api/brands/[brandId]/rules/route.ts`: list applicable brand rules and create brand custom rules.
- `app/api/brands/[brandId]/rules/[ruleId]/route.ts`: edit brand custom rules.
- `app/api/brands/[brandId]/rules/selections/route.ts`: save brand rule selections.
- `app/api/brands/[brandId]/rules/preview/route.ts`: store a compiled preview.
- `app/api/brands/[brandId]/rules/apply/route.ts`: apply stored or current preview to a new Skill File version.
- `tests/rules/starterRules.test.ts`
- `tests/rules/compileRulesToSkillPatch.test.ts`
- `tests/rules/seedStarterRules.test.ts`
- `tests/rules/ruleBankService.test.ts`
- `tests/rules/apiRoutes.test.ts`
- `tests/rules/ruleComponents.test.tsx`
- `prisma/migrations/20260430000000_add_rules_bank/migration.sql`

Modify:

- `prisma/schema.prisma`: add enums, models, and relations.
- `prisma/seed.ts`: call starter-rule seed helper.
- `package.json` and `package-lock.json`: add `jsdom` for UI component tests.
- `app/brands/[brandId]/page.tsx`: add Rules Bank action.
- `app/brands/[brandId]/skill-file/page.tsx`: add Rules Bank action and recent applications section.

## Task 1: Add Rule Domain Constants And Starter Rule Catalog

**Files:**
- Create: `lib/rules/types.ts`
- Create: `lib/rules/starterRules.ts`
- Test: `tests/rules/starterRules.test.ts`

- [ ] **Step 1: Write the failing starter-rule tests**

Create `tests/rules/starterRules.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { RULE_CATEGORIES, RULE_MODES, RULE_TARGETS } from "@/lib/rules/types";
import { STARTER_RULES } from "@/lib/rules/starterRules";

describe("STARTER_RULES", () => {
  it("uses stable unique ids and known taxonomy values", () => {
    const ids = STARTER_RULES.map((rule) => rule.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(STARTER_RULES.length).toBeGreaterThanOrEqual(12);

    for (const rule of STARTER_RULES) {
      expect(rule.source).toBe("starter");
      expect(rule.scope).toBe("global");
      expect(RULE_CATEGORIES).toContain(rule.category);
      expect(RULE_MODES).toContain(rule.mode);
      expect(rule.title.trim().length).toBeGreaterThan(4);
      expect(rule.body.trim().length).toBeGreaterThan(12);
      expect(rule.targetJson.length).toBeGreaterThan(0);
      for (const target of rule.targetJson) {
        expect(RULE_TARGETS).toContain(target);
      }
    }
  });

  it("includes concrete starter rules from the writing ruleset", () => {
    expect(STARTER_RULES.some((rule) => rule.id === "starter-fact-no-invented-claims")).toBe(true);
    expect(STARTER_RULES.some((rule) => rule.id === "starter-specificity-concrete-anchor")).toBe(true);
    expect(STARTER_RULES.some((rule) => rule.id === "starter-formula-phrases")).toBe(true);
    expect(STARTER_RULES.some((rule) => rule.id === "starter-regularity-em-dash-casual")).toBe(true);
  });

  it("stores phrases for banned phrase rules", () => {
    const formula = STARTER_RULES.find((rule) => rule.id === "starter-formula-phrases");
    expect(formula?.mode).toBe("banned_phrase");
    expect(formula?.payloadJson.phrases).toContain("ever-evolving landscape");
    expect(formula?.payloadJson.phrases).toContain("it's important to note");
  });
});
```

- [ ] **Step 2: Run the test and verify it fails**

Run:

```bash
npm test -- tests/rules/starterRules.test.ts
```

Expected: FAIL because `@/lib/rules/types` and `@/lib/rules/starterRules` do not exist.

- [ ] **Step 3: Add rule taxonomy and starter-rule types**

Create `lib/rules/types.ts`:

```ts
export const RULE_MODES = ["guidance", "hard_constraint", "banned_phrase", "retrieval_hint"] as const;
export type RuleModeValue = (typeof RULE_MODES)[number];

export const RULE_SOURCES = ["starter", "custom"] as const;
export type RuleSourceValue = (typeof RULE_SOURCES)[number];

export const RULE_SCOPES = ["global", "brand"] as const;
export type RuleScopeValue = (typeof RULE_SCOPES)[number];

export const RULE_CATEGORIES = [
  "format_fit",
  "specificity",
  "fact_discipline",
  "regularity",
  "plain_language",
  "formula_phrases",
  "accessibility",
  "stance_voice",
  "provenance",
] as const;
export type RuleCategoryValue = (typeof RULE_CATEGORIES)[number];

export const RULE_TARGETS = [
  "skill_rules",
  "linguistic_rules",
  "avoided_phrases",
  "retrieval_preferred_topics",
  "retrieval_preferred_structures",
  "retrieval_preferred_vocabulary",
  "retrieval_avoid_vocabulary",
] as const;
export type RuleTargetValue = (typeof RULE_TARGETS)[number];

export type RulePayload = {
  phrases?: string[];
  confidence?: number;
  appliesTo?: string[];
  supportingExamples?: string[];
  counterExamples?: string[];
  preferredTopics?: string[];
  preferredStructures?: string[];
  preferredVocabulary?: string[];
  avoidVocabulary?: string[];
};

export type RuleBankRuleInput = {
  id: string;
  title: string;
  body: string;
  category: RuleCategoryValue;
  mode: RuleModeValue;
  source: RuleSourceValue;
  scope: RuleScopeValue;
  brandId?: string | null;
  targetJson: RuleTargetValue[];
  payloadJson: RulePayload;
  enabled: boolean;
};

export type BrandRuleSelectionInput = {
  brandId: string;
  ruleId: string;
  selected: boolean;
  overrideJson?: {
    body?: string;
    confidence?: number;
  } | null;
};

export function parseRuleTargets(value: string | null | undefined): RuleTargetValue[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is RuleTargetValue => RULE_TARGETS.includes(item as RuleTargetValue));
  } catch {
    return [];
  }
}

export function parseRulePayload(value: string | null | undefined): RulePayload {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value) as RulePayload;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export function normalizeRuleText(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

export function uniqueStrings(values: string[]) {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const normalized = normalizeRuleText(value);
    const key = normalized.toLowerCase();
    if (!normalized || seen.has(key)) continue;
    seen.add(key);
    result.push(normalized);
  }
  return result;
}
```

- [ ] **Step 4: Add starter rules**

Create `lib/rules/starterRules.ts`:

```ts
import type { RuleBankRuleInput } from "@/lib/rules/types";

export const STARTER_RULES: RuleBankRuleInput[] = [
  {
    id: "starter-fact-no-invented-claims",
    title: "Do not invent fragile claims",
    body: "Do not invent metrics, customers, dates, quotes, roadmap timing, hidden mechanisms, motives, or factual claims.",
    category: "fact_discipline",
    mode: "hard_constraint",
    source: "starter",
    scope: "global",
    targetJson: ["skill_rules", "linguistic_rules"],
    payloadJson: { confidence: 94, appliesTo: ["all"] },
    enabled: true,
  },
  {
    id: "starter-fact-causal-restraint",
    title: "Use restrained causal language",
    body: "Do not claim that one change caused, drove, proved, or explained another unless the supplied context supports that relationship.",
    category: "fact_discipline",
    mode: "hard_constraint",
    source: "starter",
    scope: "global",
    targetJson: ["skill_rules", "linguistic_rules"],
    payloadJson: { confidence: 90, appliesTo: ["all"] },
    enabled: true,
  },
  {
    id: "starter-specificity-concrete-anchor",
    title: "Add a concrete anchor",
    body: "Each substantial paragraph or draft should carry a concrete noun, checkable detail, observed consequence, direct quote, or specific example.",
    category: "specificity",
    mode: "guidance",
    source: "starter",
    scope: "global",
    targetJson: ["skill_rules"],
    payloadJson: { confidence: 82, appliesTo: ["all"] },
    enabled: true,
  },
  {
    id: "starter-specificity-no-theater",
    title: "Avoid specificity theater",
    body: "Prefer fewer verified facts to many decorative details. Cut suspiciously exact claims, synthetic milestone names, and unsupported quotes.",
    category: "specificity",
    mode: "guidance",
    source: "starter",
    scope: "global",
    targetJson: ["skill_rules", "linguistic_rules"],
    payloadJson: { confidence: 84, appliesTo: ["all"] },
    enabled: true,
  },
  {
    id: "starter-format-match-medium",
    title: "Match format to medium",
    body: "Use structure when the medium benefits from scanning, and use running prose when casual replies, comments, DMs, or forum posts do not need lists.",
    category: "format_fit",
    mode: "guidance",
    source: "starter",
    scope: "global",
    targetJson: ["skill_rules"],
    payloadJson: { confidence: 78, appliesTo: ["all"] },
    enabled: true,
  },
  {
    id: "starter-accessibility-preserve-structure",
    title: "Preserve useful accessibility structure",
    body: "Do not remove useful headings, lists, descriptive links, citations, caveats, or next steps when the medium requires them.",
    category: "accessibility",
    mode: "guidance",
    source: "starter",
    scope: "global",
    targetJson: ["skill_rules"],
    payloadJson: { confidence: 82, appliesTo: ["all"] },
    enabled: true,
  },
  {
    id: "starter-plain-language-verbs",
    title: "Prefer plain verbs",
    body: "Prefer plain words, ordinary repetition, and active verbs over abstract noun phrases and synonym-chasing.",
    category: "plain_language",
    mode: "guidance",
    source: "starter",
    scope: "global",
    targetJson: ["skill_rules"],
    payloadJson: { confidence: 78, appliesTo: ["all"] },
    enabled: true,
  },
  {
    id: "starter-regularity-break-repeated-moves",
    title: "Break repeated visible patterns",
    body: "Watch for repeated three-part cadence, identical paragraph arcs, repeated concession rhythm, and the same punctuation move across consecutive paragraphs.",
    category: "regularity",
    mode: "guidance",
    source: "starter",
    scope: "global",
    targetJson: ["skill_rules"],
    payloadJson: { confidence: 80, appliesTo: ["all"] },
    enabled: true,
  },
  {
    id: "starter-regularity-em-dash-casual",
    title: "Limit repeated em dashes in casual prose",
    body: "In casual internet prose, prefer commas, colons, or full stops over repeated em dashes unless the dash clearly earns its keep.",
    category: "regularity",
    mode: "hard_constraint",
    source: "starter",
    scope: "global",
    targetJson: ["skill_rules", "linguistic_rules", "avoided_phrases", "retrieval_avoid_vocabulary"],
    payloadJson: { phrases: ["—"], confidence: 90, appliesTo: ["all"] },
    enabled: true,
  },
  {
    id: "starter-formula-phrases",
    title: "Avoid formula phrases",
    body: "Avoid common formula phrases unless the surrounding context makes the phrase specifically useful.",
    category: "formula_phrases",
    mode: "banned_phrase",
    source: "starter",
    scope: "global",
    targetJson: ["avoided_phrases", "retrieval_avoid_vocabulary", "skill_rules"],
    payloadJson: {
      confidence: 90,
      phrases: [
        "it's important to note",
        "it's worth noting",
        "when it comes to",
        "in conclusion",
        "in today's fast-paced world",
        "ever-evolving landscape",
        "at the end of the day",
        "dive deep into",
        "embark on a journey",
        "is a testament to",
        "plays a key role",
        "plays a pivotal role",
      ],
      appliesTo: ["all"],
    },
    enabled: true,
  },
  {
    id: "starter-formula-jargon",
    title: "Avoid default model jargon",
    body: "Avoid fallback diction such as leverage, harness, foster, empower, unlock, unveil, robust, seamless, holistic, and valuable insights unless it is the right literal word.",
    category: "formula_phrases",
    mode: "banned_phrase",
    source: "starter",
    scope: "global",
    targetJson: ["avoided_phrases", "retrieval_avoid_vocabulary", "skill_rules"],
    payloadJson: {
      confidence: 88,
      phrases: ["leverage", "harness", "foster", "empower", "unlock", "unveil", "robust", "seamless", "holistic", "valuable insights"],
      appliesTo: ["all"],
    },
    enabled: true,
  },
  {
    id: "starter-stance-match-genre",
    title: "Match stance to genre",
    body: "Use visible stance for reviews, opinion, replies, and personal posts. Keep summaries, documentation, and reporting neutral unless the user asks for a view.",
    category: "stance_voice",
    mode: "guidance",
    source: "starter",
    scope: "global",
    targetJson: ["skill_rules"],
    payloadJson: { confidence: 78, appliesTo: ["all"] },
    enabled: true,
  },
  {
    id: "starter-no-fake-human-mess",
    title: "Do not fake human messiness",
    body: "Do not add typos, forced slang, staged uncertainty, random fragments, fake profanity, or artificial sentence-length wobble to simulate humanity.",
    category: "regularity",
    mode: "hard_constraint",
    source: "starter",
    scope: "global",
    targetJson: ["skill_rules", "linguistic_rules"],
    payloadJson: { confidence: 92, appliesTo: ["all"] },
    enabled: true,
  },
  {
    id: "starter-provenance-high-stakes",
    title: "Use provenance for authorship claims",
    body: "When authorship matters, use draft history, revision history, citations, notes, outlines, source traces, and disclosed AI use rather than surface style.",
    category: "provenance",
    mode: "guidance",
    source: "starter",
    scope: "global",
    targetJson: ["skill_rules"],
    payloadJson: { confidence: 76, appliesTo: ["all"] },
    enabled: true,
  },
];
```

- [ ] **Step 5: Run the starter-rule tests**

Run:

```bash
npm test -- tests/rules/starterRules.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add lib/rules/types.ts lib/rules/starterRules.ts tests/rules/starterRules.test.ts
git commit -m "feat: add starter rules catalog"
```

## Task 2: Add Prisma Rules Bank Schema, Migration, And Seed Helper

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/20260430000000_add_rules_bank/migration.sql`
- Create: `lib/rules/seedStarterRules.ts`
- Modify: `prisma/seed.ts`
- Test: `tests/rules/seedStarterRules.test.ts`

- [ ] **Step 1: Write the failing seed helper test**

Create `tests/rules/seedStarterRules.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import { STARTER_RULES } from "@/lib/rules/starterRules";
import { seedStarterRules } from "@/lib/rules/seedStarterRules";

describe("seedStarterRules", () => {
  it("upserts every starter rule by stable id", async () => {
    const upsert = vi.fn().mockResolvedValue({});
    await seedStarterRules({ ruleBankRule: { upsert } });

    expect(upsert).toHaveBeenCalledTimes(STARTER_RULES.length);
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "starter-fact-no-invented-claims" },
        update: expect.objectContaining({ source: "STARTER", scope: "GLOBAL", enabled: true }),
        create: expect.objectContaining({ id: "starter-fact-no-invented-claims", source: "STARTER", scope: "GLOBAL" }),
      }),
    );
  });
});
```

- [ ] **Step 2: Run the test and verify it fails**

Run:

```bash
npm test -- tests/rules/seedStarterRules.test.ts
```

Expected: FAIL because `seedStarterRules` does not exist.

- [ ] **Step 3: Modify Prisma schema**

In `prisma/schema.prisma`, add these relation fields to `Brand`:

```prisma
  ruleBankRules      RuleBankRule[]
  ruleSelections     BrandRuleSelection[]
  ruleApplications   RuleApplication[]
```

Add these relation fields to `SkillFile`:

```prisma
  baseRuleApplications   RuleApplication[] @relation("RuleApplicationBaseSkillFile")
  resultRuleApplications RuleApplication[] @relation("RuleApplicationResultSkillFile")
```

Add these enums and models after the existing models:

```prisma
enum RuleSource {
  STARTER @map("starter")
  CUSTOM  @map("custom")
}

enum RuleScope {
  GLOBAL @map("global")
  BRAND  @map("brand")
}

enum RuleMode {
  GUIDANCE        @map("guidance")
  HARD_CONSTRAINT @map("hard_constraint")
  BANNED_PHRASE   @map("banned_phrase")
  RETRIEVAL_HINT  @map("retrieval_hint")
}

enum RuleCategory {
  FORMAT_FIT      @map("format_fit")
  SPECIFICITY     @map("specificity")
  FACT_DISCIPLINE @map("fact_discipline")
  REGULARITY      @map("regularity")
  PLAIN_LANGUAGE  @map("plain_language")
  FORMULA_PHRASES @map("formula_phrases")
  ACCESSIBILITY   @map("accessibility")
  STANCE_VOICE    @map("stance_voice")
  PROVENANCE      @map("provenance")
}

enum RuleTarget {
  SKILL_RULES                    @map("skill_rules")
  LINGUISTIC_RULES               @map("linguistic_rules")
  AVOIDED_PHRASES                @map("avoided_phrases")
  RETRIEVAL_PREFERRED_TOPICS     @map("retrieval_preferred_topics")
  RETRIEVAL_PREFERRED_STRUCTURES @map("retrieval_preferred_structures")
  RETRIEVAL_PREFERRED_VOCABULARY @map("retrieval_preferred_vocabulary")
  RETRIEVAL_AVOID_VOCABULARY     @map("retrieval_avoid_vocabulary")
}

enum RuleApplicationStatus {
  PREVIEWED @map("previewed")
  APPLIED   @map("applied")
  DISCARDED @map("discarded")
}

model RuleBankRule {
  id          String       @id
  title       String
  body        String
  category    RuleCategory
  mode        RuleMode
  source      RuleSource
  scope       RuleScope
  brandId     String?
  brand       Brand?       @relation(fields: [brandId], references: [id], onDelete: Cascade)
  targetJson  String
  payloadJson String
  enabled     Boolean      @default(true)
  createdAt   DateTime     @default(now())
  updatedAt   DateTime     @updatedAt

  selections BrandRuleSelection[]

  @@index([source, scope, enabled])
  @@index([brandId])
}

model BrandRuleSelection {
  id           String       @id @default(cuid())
  brandId      String
  brand        Brand        @relation(fields: [brandId], references: [id], onDelete: Cascade)
  ruleId       String
  rule         RuleBankRule @relation(fields: [ruleId], references: [id], onDelete: Cascade)
  selected     Boolean      @default(false)
  overrideJson String?
  createdAt    DateTime     @default(now())
  updatedAt    DateTime     @updatedAt

  @@unique([brandId, ruleId])
  @@index([brandId, selected])
}

model RuleApplication {
  id                   String                @id @default(cuid())
  brandId              String
  brand                Brand                 @relation(fields: [brandId], references: [id], onDelete: Cascade)
  status               RuleApplicationStatus
  selectedRuleIdsJson  String
  previewPatchJson     String
  baseSkillFileId      String
  baseSkillFileVersion String
  baseSkillFile        SkillFile             @relation("RuleApplicationBaseSkillFile", fields: [baseSkillFileId], references: [id], onDelete: Restrict)
  resultSkillFileId    String?
  resultSkillFile      SkillFile?            @relation("RuleApplicationResultSkillFile", fields: [resultSkillFileId], references: [id], onDelete: SetNull)
  createdAt            DateTime              @default(now())
  appliedAt            DateTime?

  @@index([brandId, createdAt])
  @@index([status])
}
```

- [ ] **Step 4: Add the SQL migration**

Create `prisma/migrations/20260430000000_add_rules_bank/migration.sql`:

```sql
CREATE TYPE "RuleSource" AS ENUM ('starter', 'custom');
CREATE TYPE "RuleScope" AS ENUM ('global', 'brand');
CREATE TYPE "RuleMode" AS ENUM ('guidance', 'hard_constraint', 'banned_phrase', 'retrieval_hint');
CREATE TYPE "RuleCategory" AS ENUM ('format_fit', 'specificity', 'fact_discipline', 'regularity', 'plain_language', 'formula_phrases', 'accessibility', 'stance_voice', 'provenance');
CREATE TYPE "RuleTarget" AS ENUM ('skill_rules', 'linguistic_rules', 'avoided_phrases', 'retrieval_preferred_topics', 'retrieval_preferred_structures', 'retrieval_preferred_vocabulary', 'retrieval_avoid_vocabulary');
CREATE TYPE "RuleApplicationStatus" AS ENUM ('previewed', 'applied', 'discarded');

CREATE TABLE "RuleBankRule" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "category" "RuleCategory" NOT NULL,
    "mode" "RuleMode" NOT NULL,
    "source" "RuleSource" NOT NULL,
    "scope" "RuleScope" NOT NULL,
    "brandId" TEXT,
    "targetJson" TEXT NOT NULL,
    "payloadJson" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "RuleBankRule_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BrandRuleSelection" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "ruleId" TEXT NOT NULL,
    "selected" BOOLEAN NOT NULL DEFAULT false,
    "overrideJson" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "BrandRuleSelection_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RuleApplication" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "status" "RuleApplicationStatus" NOT NULL,
    "selectedRuleIdsJson" TEXT NOT NULL,
    "previewPatchJson" TEXT NOT NULL,
    "baseSkillFileId" TEXT NOT NULL,
    "baseSkillFileVersion" TEXT NOT NULL,
    "resultSkillFileId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "appliedAt" TIMESTAMP(3),
    CONSTRAINT "RuleApplication_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "RuleBankRule_source_scope_enabled_idx" ON "RuleBankRule"("source", "scope", "enabled");
CREATE INDEX "RuleBankRule_brandId_idx" ON "RuleBankRule"("brandId");
CREATE UNIQUE INDEX "BrandRuleSelection_brandId_ruleId_key" ON "BrandRuleSelection"("brandId", "ruleId");
CREATE INDEX "BrandRuleSelection_brandId_selected_idx" ON "BrandRuleSelection"("brandId", "selected");
CREATE INDEX "RuleApplication_brandId_createdAt_idx" ON "RuleApplication"("brandId", "createdAt");
CREATE INDEX "RuleApplication_status_idx" ON "RuleApplication"("status");

ALTER TABLE "RuleBankRule" ADD CONSTRAINT "RuleBankRule_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BrandRuleSelection" ADD CONSTRAINT "BrandRuleSelection_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BrandRuleSelection" ADD CONSTRAINT "BrandRuleSelection_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "RuleBankRule"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RuleApplication" ADD CONSTRAINT "RuleApplication_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RuleApplication" ADD CONSTRAINT "RuleApplication_baseSkillFileId_fkey" FOREIGN KEY ("baseSkillFileId") REFERENCES "SkillFile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RuleApplication" ADD CONSTRAINT "RuleApplication_resultSkillFileId_fkey" FOREIGN KEY ("resultSkillFileId") REFERENCES "SkillFile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
```

- [ ] **Step 5: Add the seed helper**

Create `lib/rules/seedStarterRules.ts`:

```ts
import { STARTER_RULES } from "@/lib/rules/starterRules";

type RuleBankRuleClient = {
  upsert: (args: {
    where: { id: string };
    update: Record<string, unknown>;
    create: Record<string, unknown>;
  }) => Promise<unknown>;
};

export async function seedStarterRules(prisma: { ruleBankRule: RuleBankRuleClient }) {
  for (const rule of STARTER_RULES) {
    const data = {
      title: rule.title,
      body: rule.body,
      category: rule.category.toUpperCase(),
      mode: rule.mode.toUpperCase(),
      source: "STARTER",
      scope: "GLOBAL",
      brandId: null,
      targetJson: JSON.stringify(rule.targetJson),
      payloadJson: JSON.stringify(rule.payloadJson),
      enabled: rule.enabled,
    };

    await prisma.ruleBankRule.upsert({
      where: { id: rule.id },
      update: data,
      create: { id: rule.id, ...data },
    });
  }
}
```

- [ ] **Step 6: Wire seed helper into Prisma seed**

Modify `prisma/seed.ts`:

```ts
import { prisma } from "../lib/db";
import { seedStarterRules } from "../lib/rules/seedStarterRules";

async function main() {
  await seedStarterRules(prisma);

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

- [ ] **Step 7: Validate Prisma and tests**

Run:

```bash
npx prisma validate
npm test -- tests/rules/seedStarterRules.test.ts
```

Expected: Prisma schema is valid, seed helper test passes.

- [ ] **Step 8: Generate Prisma client**

Run:

```bash
npx prisma generate
```

Expected: Prisma Client generated successfully.

- [ ] **Step 9: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/20260430000000_add_rules_bank/migration.sql lib/rules/seedStarterRules.ts prisma/seed.ts tests/rules/seedStarterRules.test.ts
git commit -m "feat: add rules bank schema and seed"
```

## Task 3: Implement Pure Rule Compiler

**Files:**
- Create: `lib/rules/compileRulesToSkillPatch.ts`
- Test: `tests/rules/compileRulesToSkillPatch.test.ts`

- [ ] **Step 1: Write failing compiler tests**

Create `tests/rules/compileRulesToSkillPatch.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { VoiceSkillFile } from "@/lib/types";
import type { RuleBankRuleInput } from "@/lib/rules/types";
import { compileRulesToSkillPatch } from "@/lib/rules/compileRulesToSkillPatch";

const baseSkillFile = {
  version: "v1.0",
  brandName: "Metrom",
  voiceSummary: "Direct and specific.",
  linguisticRules: ["Use concrete language."],
  preferredPhrases: [],
  avoidedPhrases: ["game-changing"],
  rules: [],
  retrievalHints: { preferredTopics: [], preferredStructures: [], preferredVocabulary: [], avoidVocabulary: [] },
  exampleLibrary: { onBrand: [], offBrand: [], approvedGenerated: [], rejectedGenerated: [] },
  updatedAt: "2026-04-30T00:00:00.000Z",
} as unknown as VoiceSkillFile;

function rule(input: Partial<RuleBankRuleInput> & Pick<RuleBankRuleInput, "id" | "mode" | "body" | "targetJson">): RuleBankRuleInput {
  return {
    title: input.id,
    category: "specificity",
    source: "custom",
    scope: "global",
    payloadJson: {},
    enabled: true,
    ...input,
  };
}

describe("compileRulesToSkillPatch", () => {
  it("adds hard constraints to linguistic rules and structured rules", () => {
    const compiled = compileRulesToSkillPatch({
      skillFile: baseSkillFile,
      rules: [
        rule({
          id: "r-hard",
          mode: "hard_constraint",
          body: "Do not invent metrics.",
          targetJson: ["skill_rules", "linguistic_rules"],
          payloadJson: { confidence: 95 },
        }),
      ],
      selections: [],
      nextVersion: "v1.1",
    });

    expect(compiled.nextSkillFile.version).toBe("v1.1");
    expect(compiled.nextSkillFile.linguisticRules).toContain("Do not invent metrics.");
    expect(compiled.nextSkillFile.rules?.some((item) => item.id === "bank-r-hard" && item.confidence === 95)).toBe(true);
    expect(compiled.items).toContain("Add hard constraint: Do not invent metrics.");
  });

  it("adds banned phrases to avoided phrases and retrieval avoid vocabulary", () => {
    const compiled = compileRulesToSkillPatch({
      skillFile: baseSkillFile,
      rules: [
        rule({
          id: "r-ban",
          mode: "banned_phrase",
          body: "Avoid formula language.",
          targetJson: ["avoided_phrases", "retrieval_avoid_vocabulary", "skill_rules"],
          payloadJson: { phrases: ["ever-evolving landscape", "game-changing"] },
        }),
      ],
      selections: [],
      nextVersion: "v1.1",
    });

    expect(compiled.nextSkillFile.avoidedPhrases).toContain("ever-evolving landscape");
    expect(compiled.nextSkillFile.avoidedPhrases.filter((phrase) => phrase === "game-changing")).toHaveLength(1);
    expect(compiled.nextSkillFile.retrievalHints?.avoidVocabulary).toContain("ever-evolving landscape");
    expect(compiled.patch.avoidedPhrases).toEqual(["ever-evolving landscape"]);
  });

  it("updates retrieval hint targets", () => {
    const compiled = compileRulesToSkillPatch({
      skillFile: baseSkillFile,
      rules: [
        rule({
          id: "r-retrieval",
          mode: "retrieval_hint",
          body: "Prefer concrete examples.",
          targetJson: ["retrieval_preferred_vocabulary", "retrieval_preferred_structures"],
          payloadJson: { preferredVocabulary: ["specific"], preferredStructures: ["start with observed consequence"] },
        }),
      ],
      selections: [],
      nextVersion: "v1.1",
    });

    expect(compiled.nextSkillFile.retrievalHints?.preferredVocabulary).toContain("specific");
    expect(compiled.nextSkillFile.retrievalHints?.preferredStructures).toContain("start with observed consequence");
  });

  it("uses selected override wording and remains idempotent", () => {
    const selectedRule = rule({
      id: "r-guidance",
      mode: "guidance",
      body: "Use concrete anchors.",
      targetJson: ["skill_rules"],
    });
    const first = compileRulesToSkillPatch({
      skillFile: baseSkillFile,
      rules: [selectedRule],
      selections: [{ brandId: "b1", ruleId: "r-guidance", selected: true, overrideJson: { body: "Use one concrete anchor." } }],
      nextVersion: "v1.1",
    });
    const second = compileRulesToSkillPatch({
      skillFile: first.nextSkillFile,
      rules: [selectedRule],
      selections: [{ brandId: "b1", ruleId: "r-guidance", selected: true, overrideJson: { body: "Use one concrete anchor." } }],
      nextVersion: "v1.2",
    });

    expect(first.nextSkillFile.rules?.map((item) => item.rule)).toContain("Use one concrete anchor.");
    expect(second.nextSkillFile.rules?.filter((item) => item.id === "bank-r-guidance")).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run compiler tests and verify failure**

Run:

```bash
npm test -- tests/rules/compileRulesToSkillPatch.test.ts
```

Expected: FAIL because the compiler file does not exist.

- [ ] **Step 3: Implement the compiler**

Create `lib/rules/compileRulesToSkillPatch.ts`:

```ts
import type { SkillRule, VoiceSkillFile } from "@/lib/types";
import type { BrandRuleSelectionInput, RuleBankRuleInput, RuleTargetValue } from "@/lib/rules/types";
import { uniqueStrings } from "@/lib/rules/types";

type CompileInput = {
  skillFile: VoiceSkillFile;
  rules: RuleBankRuleInput[];
  selections: BrandRuleSelectionInput[];
  nextVersion: string;
};

export type RulesSkillPatch = {
  skillRules: SkillRule[];
  linguisticRules: string[];
  avoidedPhrases: string[];
  retrievalHints: {
    preferredTopics: string[];
    preferredStructures: string[];
    preferredVocabulary: string[];
    avoidVocabulary: string[];
  };
};

export type CompiledRulesSkillPatch = {
  nextSkillFile: VoiceSkillFile;
  patch: RulesSkillPatch;
  items: string[];
  selectedRuleIds: string[];
  baseVersion: string;
};

const FALLBACK_CONFIDENCE = {
  guidance: 76,
  hard_constraint: 92,
  banned_phrase: 90,
  retrieval_hint: 78,
} as const;

function hasTarget(rule: RuleBankRuleInput, target: RuleTargetValue) {
  return rule.targetJson.includes(target);
}

function selectionFor(ruleId: string, selections: BrandRuleSelectionInput[]) {
  return selections.find((selection) => selection.ruleId === ruleId);
}

function ruleBody(rule: RuleBankRuleInput, selections: BrandRuleSelectionInput[]) {
  return selectionFor(rule.id, selections)?.overrideJson?.body?.trim() || rule.body;
}

function confidence(rule: RuleBankRuleInput, selections: BrandRuleSelectionInput[]) {
  return selectionFor(rule.id, selections)?.overrideJson?.confidence ?? rule.payloadJson.confidence ?? FALLBACK_CONFIDENCE[rule.mode];
}

function createSkillRule(rule: RuleBankRuleInput, body: string, confidenceValue: number): SkillRule {
  return {
    id: `bank-${rule.id}`,
    layer: rule.mode === "retrieval_hint" ? "context" : rule.mode === "guidance" ? "context" : "mechanics",
    rule: body,
    confidence: confidenceValue,
    supportingExamples: rule.payloadJson.supportingExamples ?? [],
    counterExamples: rule.payloadJson.counterExamples ?? [],
    appliesTo: rule.payloadJson.appliesTo ?? ["all"],
  };
}

function mergeRules(existing: SkillRule[], incoming: SkillRule[]) {
  const byId = new Map<string, SkillRule>();
  for (const rule of existing) byId.set(rule.id, rule);
  for (const rule of incoming) byId.set(rule.id, rule);
  return Array.from(byId.values());
}

function additions(existing: string[], incoming: string[]) {
  const existingKeys = new Set(existing.map((value) => value.trim().toLowerCase()));
  return uniqueStrings(incoming).filter((value) => !existingKeys.has(value.toLowerCase()));
}

export function compileRulesToSkillPatch({ skillFile, rules, selections, nextVersion }: CompileInput): CompiledRulesSkillPatch {
  const activeRules = rules.filter((rule) => rule.enabled);
  const selectedRuleIds = activeRules.map((rule) => rule.id);
  const existingRetrievalHints = skillFile.retrievalHints ?? {
    preferredTopics: [],
    preferredStructures: [],
    preferredVocabulary: [],
    avoidVocabulary: [],
  };
  const patch: RulesSkillPatch = {
    skillRules: [],
    linguisticRules: [],
    avoidedPhrases: [],
    retrievalHints: {
      preferredTopics: [],
      preferredStructures: [],
      preferredVocabulary: [],
      avoidVocabulary: [],
    },
  };
  const items: string[] = [];

  for (const rule of activeRules) {
    const body = ruleBody(rule, selections);
    const confidenceValue = confidence(rule, selections);

    if (hasTarget(rule, "skill_rules")) {
      const skillRule = createSkillRule(rule, body, confidenceValue);
      patch.skillRules.push(skillRule);
      items.push(rule.mode === "hard_constraint" ? `Add hard constraint: ${body}` : `Add rule: ${body}`);
    }

    if (hasTarget(rule, "linguistic_rules")) {
      patch.linguisticRules.push(body);
      if (rule.mode === "hard_constraint" && !items.includes(`Add hard constraint: ${body}`)) {
        items.push(`Add hard constraint: ${body}`);
      }
    }

    if (rule.mode === "banned_phrase" || hasTarget(rule, "avoided_phrases")) {
      patch.avoidedPhrases.push(...(rule.payloadJson.phrases ?? []));
      for (const phrase of rule.payloadJson.phrases ?? []) items.push(`Avoid phrase: ${phrase}`);
    }

    if (hasTarget(rule, "retrieval_preferred_topics")) {
      patch.retrievalHints.preferredTopics.push(...(rule.payloadJson.preferredTopics ?? []));
    }
    if (hasTarget(rule, "retrieval_preferred_structures")) {
      patch.retrievalHints.preferredStructures.push(...(rule.payloadJson.preferredStructures ?? []));
    }
    if (hasTarget(rule, "retrieval_preferred_vocabulary")) {
      patch.retrievalHints.preferredVocabulary.push(...(rule.payloadJson.preferredVocabulary ?? []));
    }
    if (hasTarget(rule, "retrieval_avoid_vocabulary")) {
      patch.retrievalHints.avoidVocabulary.push(...(rule.payloadJson.avoidVocabulary ?? []), ...(rule.payloadJson.phrases ?? []));
    }
  }

  patch.linguisticRules = additions(skillFile.linguisticRules ?? [], patch.linguisticRules);
  patch.avoidedPhrases = additions(skillFile.avoidedPhrases ?? [], patch.avoidedPhrases);
  patch.retrievalHints.preferredTopics = additions(existingRetrievalHints.preferredTopics, patch.retrievalHints.preferredTopics);
  patch.retrievalHints.preferredStructures = additions(existingRetrievalHints.preferredStructures, patch.retrievalHints.preferredStructures);
  patch.retrievalHints.preferredVocabulary = additions(existingRetrievalHints.preferredVocabulary, patch.retrievalHints.preferredVocabulary);
  patch.retrievalHints.avoidVocabulary = additions(existingRetrievalHints.avoidVocabulary, patch.retrievalHints.avoidVocabulary);

  const nextSkillFile: VoiceSkillFile = {
    ...skillFile,
    version: nextVersion,
    linguisticRules: uniqueStrings([...(skillFile.linguisticRules ?? []), ...patch.linguisticRules]),
    avoidedPhrases: uniqueStrings([...(skillFile.avoidedPhrases ?? []), ...patch.avoidedPhrases]),
    rules: mergeRules(skillFile.rules ?? [], patch.skillRules),
    retrievalHints: {
      preferredTopics: uniqueStrings([...existingRetrievalHints.preferredTopics, ...patch.retrievalHints.preferredTopics]),
      preferredStructures: uniqueStrings([...existingRetrievalHints.preferredStructures, ...patch.retrievalHints.preferredStructures]),
      preferredVocabulary: uniqueStrings([...existingRetrievalHints.preferredVocabulary, ...patch.retrievalHints.preferredVocabulary]),
      avoidVocabulary: uniqueStrings([...existingRetrievalHints.avoidVocabulary, ...patch.retrievalHints.avoidVocabulary]),
    },
    updatedAt: new Date().toISOString(),
  };

  return {
    nextSkillFile,
    patch,
    items: uniqueStrings(items),
    selectedRuleIds,
    baseVersion: skillFile.version,
  };
}
```

- [ ] **Step 4: Run compiler tests**

Run:

```bash
npm test -- tests/rules/compileRulesToSkillPatch.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/rules/compileRulesToSkillPatch.ts tests/rules/compileRulesToSkillPatch.test.ts
git commit -m "feat: compile rules into skill file patches"
```

## Task 4: Add Rule Bank Service

**Files:**
- Create: `lib/rules/ruleBankService.ts`
- Test: `tests/rules/ruleBankService.test.ts`

- [ ] **Step 1: Write failing service tests**

Create `tests/rules/ruleBankService.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import { createCustomRule, saveBrandRuleSelections, previewSelectedRules, applyRulePreview } from "@/lib/rules/ruleBankService";

describe("ruleBankService", () => {
  it("validates banned phrase custom rules", async () => {
    await expect(
      createCustomRule({
        prisma: {} as never,
        input: {
          title: "Ban empty",
          body: "Avoid empty phrases.",
          category: "formula_phrases",
          mode: "banned_phrase",
          scope: "global",
          targetJson: ["avoided_phrases"],
          payloadJson: { phrases: [] },
        },
      }),
    ).rejects.toThrow("Banned phrase rules require at least one phrase.");
  });

  it("upserts brand selections without creating skill files", async () => {
    const upsert = vi.fn().mockResolvedValue({});
    await saveBrandRuleSelections({
      prisma: { brandRuleSelection: { upsert } },
      brandId: "b1",
      selections: [{ ruleId: "r1", selected: true }],
    });
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { brandId_ruleId: { brandId: "b1", ruleId: "r1" } },
        update: { selected: true, overrideJson: null },
      }),
    );
  });

  it("stores preview applications without creating a skill file", async () => {
    const latestSkill = {
      id: "sf1",
      version: "v1.0",
      skillJson: JSON.stringify({
        version: "v1.0",
        linguisticRules: [],
        avoidedPhrases: [],
        rules: [],
        retrievalHints: { preferredTopics: [], preferredStructures: [], preferredVocabulary: [], avoidVocabulary: [] },
        exampleLibrary: { onBrand: [], offBrand: [], approvedGenerated: [], rejectedGenerated: [] },
      }),
    };
    const create = vi.fn().mockResolvedValue({ id: "preview1" });
    const result = await previewSelectedRules({
      prisma: {
        skillFile: { findFirst: vi.fn().mockResolvedValue(latestSkill) },
        brandRuleSelection: { findMany: vi.fn().mockResolvedValue([{ ruleId: "r1", selected: true, overrideJson: null }]) },
        ruleBankRule: {
          findMany: vi.fn().mockResolvedValue([
            {
              id: "r1",
              title: "Rule",
              body: "Do not invent metrics.",
              category: "FACT_DISCIPLINE",
              mode: "HARD_CONSTRAINT",
              source: "CUSTOM",
              scope: "GLOBAL",
              brandId: null,
              targetJson: JSON.stringify(["skill_rules", "linguistic_rules"]),
              payloadJson: JSON.stringify({ confidence: 95 }),
              enabled: true,
            },
          ]),
        },
        ruleApplication: { create },
      },
      brandId: "b1",
      nextVersion: "v1.1",
    });
    expect(result.preview.id).toBe("preview1");
    expect(create).toHaveBeenCalledOnce();
  });

  it("rejects stale previews during apply", async () => {
    await expect(
      applyRulePreview({
        prisma: {
          ruleApplication: { findUnique: vi.fn().mockResolvedValue({ baseSkillFileId: "old", status: "PREVIEWED" }) },
          skillFile: { findFirst: vi.fn().mockResolvedValue({ id: "new", version: "v1.2" }) },
        },
        brandId: "b1",
        previewId: "preview1",
      } as never),
    ).rejects.toThrow("Preview is stale. Preview again against the latest Skill File.");
  });
});
```

- [ ] **Step 2: Run service tests and verify failure**

Run:

```bash
npm test -- tests/rules/ruleBankService.test.ts
```

Expected: FAIL because `ruleBankService` does not exist.

- [ ] **Step 3: Implement service helpers**

Create `lib/rules/ruleBankService.ts` with these exported functions:

```ts
import { parseJsonField, stringifyJsonField } from "@/lib/request";
import type { VoiceSkillFile } from "@/lib/types";
import { nextSkillVersion } from "@/lib/voice/versioning";
import { compileRulesToSkillPatch } from "@/lib/rules/compileRulesToSkillPatch";
import type { BrandRuleSelectionInput, RuleBankRuleInput, RuleCategoryValue, RuleModeValue, RulePayload, RuleScopeValue, RuleTargetValue } from "@/lib/rules/types";
import { RULE_CATEGORIES, RULE_MODES, RULE_SCOPES, RULE_TARGETS, parseRulePayload, parseRuleTargets } from "@/lib/rules/types";

type PrismaLike = Record<string, any>;

type RawRule = {
  id: string;
  title: string;
  body: string;
  category: string;
  mode: string;
  source: string;
  scope: string;
  brandId?: string | null;
  targetJson: string;
  payloadJson: string;
  enabled: boolean;
};

function enumToValue(value: string) {
  return value.toLowerCase();
}

function toRuleInput(rule: RawRule): RuleBankRuleInput {
  return {
    id: rule.id,
    title: rule.title,
    body: rule.body,
    category: enumToValue(rule.category) as RuleCategoryValue,
    mode: enumToValue(rule.mode) as RuleModeValue,
    source: enumToValue(rule.source) as "starter" | "custom",
    scope: enumToValue(rule.scope) as RuleScopeValue,
    brandId: rule.brandId,
    targetJson: parseRuleTargets(rule.targetJson),
    payloadJson: parseRulePayload(rule.payloadJson),
    enabled: rule.enabled,
  };
}

function toEnum(value: string) {
  return value.toUpperCase();
}

function validateRuleInput(input: {
  title: string;
  body: string;
  category: RuleCategoryValue;
  mode: RuleModeValue;
  scope: RuleScopeValue;
  targetJson: RuleTargetValue[];
  payloadJson: RulePayload;
}) {
  if (!input.title.trim()) throw new Error("Rule title is required.");
  if (!input.body.trim()) throw new Error("Rule body is required.");
  if (!RULE_CATEGORIES.includes(input.category)) throw new Error("Rule category is invalid.");
  if (!RULE_MODES.includes(input.mode)) throw new Error("Rule mode is invalid.");
  if (!RULE_SCOPES.includes(input.scope)) throw new Error("Rule scope is invalid.");
  if (!input.targetJson.length || input.targetJson.some((target) => !RULE_TARGETS.includes(target))) throw new Error("Rule target is invalid.");
  if (input.mode === "banned_phrase" && !(input.payloadJson.phrases ?? []).some((phrase) => phrase.trim())) {
    throw new Error("Banned phrase rules require at least one phrase.");
  }
}

export async function listApplicableBrandRules({ prisma, brandId }: { prisma: PrismaLike; brandId: string }) {
  const [rules, selections, applications, latestSkillFile] = await Promise.all([
    prisma.ruleBankRule.findMany({
      where: { enabled: true, OR: [{ scope: "GLOBAL" }, { brandId }] },
      orderBy: [{ source: "asc" }, { category: "asc" }, { title: "asc" }],
    }),
    prisma.brandRuleSelection.findMany({ where: { brandId } }),
    prisma.ruleApplication.findMany({ where: { brandId }, orderBy: { createdAt: "desc" }, take: 8 }),
    prisma.skillFile.findFirst({ where: { brandId }, orderBy: { createdAt: "desc" }, select: { id: true, version: true, createdAt: true } }),
  ]);
  return { rules: rules.map(toRuleInput), selections, applications, latestSkillFile };
}

export async function listGlobalRules({ prisma }: { prisma: PrismaLike }) {
  const rules = await prisma.ruleBankRule.findMany({
    where: { scope: "GLOBAL" },
    orderBy: [{ source: "asc" }, { category: "asc" }, { title: "asc" }],
  });
  return rules.map(toRuleInput);
}

export async function createCustomRule({
  prisma,
  brandId,
  input,
}: {
  prisma: PrismaLike;
  brandId?: string;
  input: {
    title: string;
    body: string;
    category: RuleCategoryValue;
    mode: RuleModeValue;
    scope: RuleScopeValue;
    targetJson: RuleTargetValue[];
    payloadJson: RulePayload;
  };
}) {
  validateRuleInput(input);
  const scope = brandId ? "brand" : input.scope;
  const rule = await prisma.ruleBankRule.create({
    data: {
      title: input.title.trim(),
      body: input.body.trim(),
      category: toEnum(input.category),
      mode: toEnum(input.mode),
      source: "CUSTOM",
      scope: toEnum(scope),
      brandId: brandId ?? null,
      targetJson: stringifyJsonField(input.targetJson),
      payloadJson: stringifyJsonField(input.payloadJson),
      enabled: true,
    },
  });
  return toRuleInput(rule);
}

export async function updateCustomRule({ prisma, ruleId, brandId, input }: { prisma: PrismaLike; ruleId: string; brandId?: string; input: Parameters<typeof createCustomRule>[0]["input"] }) {
  validateRuleInput(input);
  const existing = await prisma.ruleBankRule.findUnique({ where: { id: ruleId } });
  if (!existing || existing.source !== "CUSTOM") throw new Error("Only custom rules can be edited.");
  if (brandId && existing.brandId !== brandId) throw new Error("Rule does not belong to this brand.");
  if (!brandId && existing.scope !== "GLOBAL") throw new Error("Only global custom rules can be edited here.");
  const rule = await prisma.ruleBankRule.update({
    where: { id: ruleId },
    data: {
      title: input.title.trim(),
      body: input.body.trim(),
      category: toEnum(input.category),
      mode: toEnum(input.mode),
      targetJson: stringifyJsonField(input.targetJson),
      payloadJson: stringifyJsonField(input.payloadJson),
    },
  });
  return toRuleInput(rule);
}

export async function saveBrandRuleSelections({ prisma, brandId, selections }: { prisma: PrismaLike; brandId: string; selections: { ruleId: string; selected: boolean; overrideJson?: unknown }[] }) {
  await Promise.all(
    selections.map((selection) =>
      prisma.brandRuleSelection.upsert({
        where: { brandId_ruleId: { brandId, ruleId: selection.ruleId } },
        update: { selected: selection.selected, overrideJson: selection.overrideJson ? stringifyJsonField(selection.overrideJson) : null },
        create: { brandId, ruleId: selection.ruleId, selected: selection.selected, overrideJson: selection.overrideJson ? stringifyJsonField(selection.overrideJson) : null },
      }),
    ),
  );
  return { ok: true };
}

async function selectedRulesForBrand(prisma: PrismaLike, brandId: string) {
  const selections = await prisma.brandRuleSelection.findMany({ where: { brandId, selected: true } });
  const selectedIds = selections.map((selection: { ruleId: string }) => selection.ruleId);
  const rules = selectedIds.length
    ? await prisma.ruleBankRule.findMany({ where: { id: { in: selectedIds }, enabled: true, OR: [{ scope: "GLOBAL" }, { brandId }] } })
    : [];
  const normalizedSelections: BrandRuleSelectionInput[] = selections.map((selection: { ruleId: string; selected: boolean; overrideJson?: string | null }) => ({
    brandId,
    ruleId: selection.ruleId,
    selected: selection.selected,
    overrideJson: parseJsonField(selection.overrideJson, null),
  }));
  return { rules: rules.map(toRuleInput), selections: normalizedSelections };
}

export async function previewSelectedRules({ prisma, brandId, nextVersion }: { prisma: PrismaLike; brandId: string; nextVersion?: string }) {
  const latest = await prisma.skillFile.findFirst({ where: { brandId }, orderBy: { createdAt: "desc" } });
  if (!latest) throw new Error("Create a Skill File before previewing rules.");
  const skillFile = parseJsonField<VoiceSkillFile | null>(latest.skillJson, null);
  if (!skillFile) throw new Error("Latest Skill File could not be parsed.");
  const selected = await selectedRulesForBrand(prisma, brandId);
  const compiled = compileRulesToSkillPatch({
    skillFile,
    rules: selected.rules,
    selections: selected.selections,
    nextVersion: nextVersion ?? nextSkillVersion(latest.version),
  });
  const preview = await prisma.ruleApplication.create({
    data: {
      brandId,
      status: "PREVIEWED",
      selectedRuleIdsJson: stringifyJsonField(compiled.selectedRuleIds),
      previewPatchJson: stringifyJsonField(compiled),
      baseSkillFileId: latest.id,
      baseSkillFileVersion: latest.version,
    },
  });
  return { preview, compiled };
}

export async function applyRulePreview({ prisma, brandId, previewId }: { prisma: PrismaLike; brandId: string; previewId: string }) {
  const preview = await prisma.ruleApplication.findUnique({ where: { id: previewId } });
  if (!preview || preview.brandId !== brandId) throw new Error("Preview not found.");
  if (preview.status !== "PREVIEWED") throw new Error("Preview has already been applied or discarded.");
  const latest = await prisma.skillFile.findFirst({ where: { brandId }, orderBy: { createdAt: "desc" } });
  if (!latest || latest.id !== preview.baseSkillFileId || latest.version !== preview.baseSkillFileVersion) {
    throw new Error("Preview is stale. Preview again against the latest Skill File.");
  }
  const compiled = parseJsonField<{ nextSkillFile: VoiceSkillFile } | null>(preview.previewPatchJson, null);
  if (!compiled?.nextSkillFile) throw new Error("Preview patch could not be parsed.");
  const skillFile = await prisma.skillFile.create({
    data: {
      brandId,
      version: compiled.nextSkillFile.version,
      skillJson: stringifyJsonField(compiled.nextSkillFile),
    },
  });
  const updatedPreview = await prisma.ruleApplication.update({
    where: { id: preview.id },
    data: { status: "APPLIED", resultSkillFileId: skillFile.id, appliedAt: new Date() },
  });
  return { skillFile, application: updatedPreview };
}
```

- [ ] **Step 4: Run service tests**

Run:

```bash
npm test -- tests/rules/ruleBankService.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/rules/ruleBankService.ts tests/rules/ruleBankService.test.ts
git commit -m "feat: add rules bank service"
```

## Task 5: Add Rules Bank API Routes

**Files:**
- Create: `app/api/rules/route.ts`
- Create: `app/api/rules/[ruleId]/route.ts`
- Create: `app/api/brands/[brandId]/rules/route.ts`
- Create: `app/api/brands/[brandId]/rules/[ruleId]/route.ts`
- Create: `app/api/brands/[brandId]/rules/selections/route.ts`
- Create: `app/api/brands/[brandId]/rules/preview/route.ts`
- Create: `app/api/brands/[brandId]/rules/apply/route.ts`
- Test: `tests/rules/apiRoutes.test.ts`

- [ ] **Step 1: Write failing API route tests**

Create `tests/rules/apiRoutes.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const service = vi.hoisted(() => ({
  listGlobalRules: vi.fn(),
  createCustomRule: vi.fn(),
  updateCustomRule: vi.fn(),
  listApplicableBrandRules: vi.fn(),
  saveBrandRuleSelections: vi.fn(),
  previewSelectedRules: vi.fn(),
  applyRulePreview: vi.fn(),
}));

vi.mock("@/lib/rules/ruleBankService", () => service);
vi.mock("@/lib/db", () => ({ prisma: {} }));

describe("rules API routes", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("lists global rules", async () => {
    service.listGlobalRules.mockResolvedValue([{ id: "r1" }]);
    const { GET } = await import("@/app/api/rules/route");
    const response = await GET();
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ rules: [{ id: "r1" }] });
  });

  it("creates a global custom rule", async () => {
    service.createCustomRule.mockResolvedValue({ id: "r2" });
    const { POST } = await import("@/app/api/rules/route");
    const response = await POST(new Request("http://localhost/api/rules", { method: "POST", body: JSON.stringify({ title: "Rule", body: "Body" }) }));
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ rule: { id: "r2" } });
  });

  it("returns service errors as 400s for invalid custom rules", async () => {
    service.createCustomRule.mockRejectedValue(new Error("Rule title is required."));
    const { POST } = await import("@/app/api/rules/route");
    const response = await POST(new Request("http://localhost/api/rules", { method: "POST", body: JSON.stringify({}) }));
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Rule title is required." });
  });

  it("saves brand selections", async () => {
    service.saveBrandRuleSelections.mockResolvedValue({ ok: true });
    const { PATCH } = await import("@/app/api/brands/[brandId]/rules/selections/route");
    const response = await PATCH(new Request("http://localhost/api/brands/b1/rules/selections", { method: "PATCH", body: JSON.stringify({ selections: [{ ruleId: "r1", selected: true }] }) }), {
      params: Promise.resolve({ brandId: "b1" }),
    });
    expect(response.status).toBe(200);
    expect(service.saveBrandRuleSelections).toHaveBeenCalledWith(expect.objectContaining({ brandId: "b1", selections: [{ ruleId: "r1", selected: true }] }));
  });

  it("previews selected rules", async () => {
    service.previewSelectedRules.mockResolvedValue({ preview: { id: "p1" }, compiled: { items: ["Add rule"] } });
    const { POST } = await import("@/app/api/brands/[brandId]/rules/preview/route");
    const response = await POST(new Request("http://localhost/api/brands/b1/rules/preview", { method: "POST", body: "{}" }), { params: Promise.resolve({ brandId: "b1" }) });
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ preview: { id: "p1" }, compiled: { items: ["Add rule"] } });
  });

  it("applies a preview", async () => {
    service.applyRulePreview.mockResolvedValue({ skillFile: { id: "sf2", version: "v1.1" }, application: { id: "p1" } });
    const { POST } = await import("@/app/api/brands/[brandId]/rules/apply/route");
    const response = await POST(new Request("http://localhost/api/brands/b1/rules/apply", { method: "POST", body: JSON.stringify({ previewId: "p1" }) }), { params: Promise.resolve({ brandId: "b1" }) });
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ skillFile: { version: "v1.1" } });
  });
});
```

- [ ] **Step 2: Run API tests and verify failure**

Run:

```bash
npm test -- tests/rules/apiRoutes.test.ts
```

Expected: FAIL because routes do not exist.

- [ ] **Step 3: Implement global rules routes**

Create `app/api/rules/route.ts`:

```ts
import { prisma } from "@/lib/db";
import { jsonError, jsonErrorFromUnknown, jsonOk } from "@/lib/request";
import { createCustomRule, listGlobalRules } from "@/lib/rules/ruleBankService";

export async function GET() {
  return jsonOk({ rules: await listGlobalRules({ prisma }) });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const rule = await createCustomRule({
      prisma,
      input: {
        title: body.title,
        body: body.body,
        category: body.category || "specificity",
        mode: body.mode || "guidance",
        scope: "global",
        targetJson: body.targetJson || ["skill_rules"],
        payloadJson: body.payloadJson || {},
      },
    });
    return jsonOk({ rule });
  } catch (error) {
    if (error instanceof Error) return jsonError(error.message, 400);
    return jsonErrorFromUnknown(error, "Could not create rule.", 500);
  }
}
```

Create `app/api/rules/[ruleId]/route.ts`:

```ts
import { prisma } from "@/lib/db";
import { jsonError, jsonErrorFromUnknown, jsonOk } from "@/lib/request";
import { updateCustomRule } from "@/lib/rules/ruleBankService";

export async function PATCH(request: Request, { params }: { params: Promise<{ ruleId: string }> }) {
  try {
    const { ruleId } = await params;
    const body = await request.json();
    const rule = await updateCustomRule({
      prisma,
      ruleId,
      input: {
        title: body.title,
        body: body.body,
        category: body.category,
        mode: body.mode,
        scope: "global",
        targetJson: body.targetJson,
        payloadJson: body.payloadJson || {},
      },
    });
    return jsonOk({ rule });
  } catch (error) {
    if (error instanceof Error) return jsonError(error.message, 400);
    return jsonErrorFromUnknown(error, "Could not update rule.", 500);
  }
}
```

- [ ] **Step 4: Implement brand rules routes**

Create `app/api/brands/[brandId]/rules/route.ts`:

```ts
import { prisma } from "@/lib/db";
import { jsonError, jsonErrorFromUnknown, jsonOk } from "@/lib/request";
import { createCustomRule, listApplicableBrandRules } from "@/lib/rules/ruleBankService";

export async function GET(_request: Request, { params }: { params: Promise<{ brandId: string }> }) {
  const { brandId } = await params;
  return jsonOk(await listApplicableBrandRules({ prisma, brandId }));
}

export async function POST(request: Request, { params }: { params: Promise<{ brandId: string }> }) {
  try {
    const { brandId } = await params;
    const body = await request.json();
    const rule = await createCustomRule({
      prisma,
      brandId,
      input: {
        title: body.title,
        body: body.body,
        category: body.category || "specificity",
        mode: body.mode || "guidance",
        scope: "brand",
        targetJson: body.targetJson || ["skill_rules"],
        payloadJson: body.payloadJson || {},
      },
    });
    return jsonOk({ rule });
  } catch (error) {
    if (error instanceof Error) return jsonError(error.message, 400);
    return jsonErrorFromUnknown(error, "Could not create brand rule.", 500);
  }
}
```

Create `app/api/brands/[brandId]/rules/[ruleId]/route.ts`:

```ts
import { prisma } from "@/lib/db";
import { jsonError, jsonErrorFromUnknown, jsonOk } from "@/lib/request";
import { updateCustomRule } from "@/lib/rules/ruleBankService";

export async function PATCH(request: Request, { params }: { params: Promise<{ brandId: string; ruleId: string }> }) {
  try {
    const { brandId, ruleId } = await params;
    const body = await request.json();
    const rule = await updateCustomRule({
      prisma,
      brandId,
      ruleId,
      input: {
        title: body.title,
        body: body.body,
        category: body.category,
        mode: body.mode,
        scope: "brand",
        targetJson: body.targetJson,
        payloadJson: body.payloadJson || {},
      },
    });
    return jsonOk({ rule });
  } catch (error) {
    if (error instanceof Error) return jsonError(error.message, 400);
    return jsonErrorFromUnknown(error, "Could not update brand rule.", 500);
  }
}
```

- [ ] **Step 5: Implement selection, preview, and apply routes**

Create `app/api/brands/[brandId]/rules/selections/route.ts`:

```ts
import { prisma } from "@/lib/db";
import { jsonError, jsonErrorFromUnknown, jsonOk } from "@/lib/request";
import { saveBrandRuleSelections } from "@/lib/rules/ruleBankService";

export async function PATCH(request: Request, { params }: { params: Promise<{ brandId: string }> }) {
  try {
    const { brandId } = await params;
    const body = await request.json();
    if (!Array.isArray(body.selections)) return jsonError("Selections must be an array.", 400);
    return jsonOk(await saveBrandRuleSelections({ prisma, brandId, selections: body.selections }));
  } catch (error) {
    return jsonErrorFromUnknown(error, "Could not save rule selections.", 500);
  }
}
```

Create `app/api/brands/[brandId]/rules/preview/route.ts`:

```ts
import { prisma } from "@/lib/db";
import { jsonError, jsonErrorFromUnknown, jsonOk } from "@/lib/request";
import { previewSelectedRules } from "@/lib/rules/ruleBankService";

export async function POST(_request: Request, { params }: { params: Promise<{ brandId: string }> }) {
  try {
    const { brandId } = await params;
    return jsonOk(await previewSelectedRules({ prisma, brandId }));
  } catch (error) {
    if (error instanceof Error) return jsonError(error.message, 400);
    return jsonErrorFromUnknown(error, "Could not preview rules.", 500);
  }
}
```

Create `app/api/brands/[brandId]/rules/apply/route.ts`:

```ts
import { prisma } from "@/lib/db";
import { jsonError, jsonErrorFromUnknown, jsonOk } from "@/lib/request";
import { applyRulePreview } from "@/lib/rules/ruleBankService";

export async function POST(request: Request, { params }: { params: Promise<{ brandId: string }> }) {
  try {
    const { brandId } = await params;
    const body = await request.json();
    if (!body.previewId || typeof body.previewId !== "string") return jsonError("previewId is required.", 400);
    return jsonOk(await applyRulePreview({ prisma, brandId, previewId: body.previewId }));
  } catch (error) {
    if (error instanceof Error) return jsonError(error.message, 400);
    return jsonErrorFromUnknown(error, "Could not apply rules.", 500);
  }
}
```

- [ ] **Step 6: Run API tests**

Run:

```bash
npm test -- tests/rules/apiRoutes.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add app/api/rules app/api/brands/[brandId]/rules tests/rules/apiRoutes.test.ts
git commit -m "feat: add rules bank api routes"
```

## Task 6: Add Rules UI Components

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `components/rules/RuleForm.tsx`
- Create: `components/rules/RuleList.tsx`
- Create: `components/rules/BrandRulesClient.tsx`
- Create: `components/rules/GlobalRulesClient.tsx`
- Test: `tests/rules/ruleComponents.test.tsx`

- [ ] **Step 1: Add jsdom for UI tests**

Run:

```bash
npm install --save-dev jsdom
```

Expected: `package.json` and `package-lock.json` update with `jsdom`.

- [ ] **Step 2: Write failing component tests**

Create `tests/rules/ruleComponents.test.tsx`:

```tsx
// @vitest-environment jsdom
import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { RuleBankRuleInput } from "@/lib/rules/types";
import { RuleList } from "@/components/rules/RuleList";

const rules: RuleBankRuleInput[] = [
  {
    id: "r1",
    title: "Concrete anchor",
    body: "Add a concrete anchor.",
    category: "specificity",
    mode: "guidance",
    source: "starter",
    scope: "global",
    targetJson: ["skill_rules"],
    payloadJson: {},
    enabled: true,
  },
  {
    id: "r2",
    title: "Ban phrases",
    body: "Avoid formula phrases.",
    category: "formula_phrases",
    mode: "banned_phrase",
    source: "custom",
    scope: "global",
    targetJson: ["avoided_phrases"],
    payloadJson: { phrases: ["ever-evolving landscape"] },
    enabled: true,
  },
];

describe("RuleList", () => {
  it("renders rules and toggles a selected rule", () => {
    const onSelectionChange = vi.fn();
    render(<RuleList rules={rules} selectedRuleIds={["r1"]} onSelectionChange={onSelectionChange} />);

    expect(screen.getByText("Concrete anchor")).toBeTruthy();
    expect(screen.getByText("Ban phrases")).toBeTruthy();
    fireEvent.click(screen.getByLabelText("Select Ban phrases"));
    expect(onSelectionChange).toHaveBeenCalledWith("r2", true);
  });

  it("filters by mode", () => {
    render(<RuleList rules={rules} selectedRuleIds={[]} onSelectionChange={() => undefined} />);
    fireEvent.change(screen.getByLabelText("Mode"), { target: { value: "banned_phrase" } });

    expect(screen.queryByText("Concrete anchor")).toBeNull();
    expect(screen.getByText("Ban phrases")).toBeTruthy();
  });
});
```

- [ ] **Step 3: Run component tests and verify failure**

Run:

```bash
npm test -- tests/rules/ruleComponents.test.tsx
```

Expected: FAIL because `RuleList` does not exist.

- [ ] **Step 4: Create the custom rule form**

Create `components/rules/RuleForm.tsx`:

```tsx
"use client";

import { useState } from "react";
import { RULE_CATEGORIES, RULE_MODES, RULE_TARGETS, type RuleBankRuleInput, type RuleCategoryValue, type RuleModeValue, type RuleTargetValue } from "@/lib/rules/types";

export function RuleForm({ onCreated, brandId }: { onCreated: (rule: RuleBankRuleInput) => void; brandId?: string }) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [category, setCategory] = useState<RuleCategoryValue>("specificity");
  const [mode, setMode] = useState<RuleModeValue>("guidance");
  const [target, setTarget] = useState<RuleTargetValue>("skill_rules");
  const [phrases, setPhrases] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);
    const payloadJson = mode === "banned_phrase" ? { phrases: phrases.split(/\n|,/g).map((item) => item.trim()).filter(Boolean) } : {};
    const response = await fetch(brandId ? `/api/brands/${brandId}/rules` : "/api/rules", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title, body, category, mode, targetJson: [target], payloadJson }),
    });
    const json = await response.json();
    setLoading(false);
    if (!response.ok) {
      setError(json.error || "Could not create rule.");
      return;
    }
    setTitle("");
    setBody("");
    setPhrases("");
    onCreated(json.rule);
  }

  return (
    <form onSubmit={submit} className="space-y-3 spool-plate-soft p-4">
      <h2 className="font-semibold text-ink">Create custom rule</h2>
      <label className="block space-y-1">
        <span className="text-sm font-medium text-ink">Title</span>
        <input value={title} onChange={(event) => setTitle(event.target.value)} className="spool-field" required />
      </label>
      <label className="block space-y-1">
        <span className="text-sm font-medium text-ink">Rule text</span>
        <textarea value={body} onChange={(event) => setBody(event.target.value)} className="min-h-24 spool-field" required />
      </label>
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="block space-y-1">
          <span className="text-sm font-medium text-ink">Category</span>
          <select value={category} onChange={(event) => setCategory(event.target.value as RuleCategoryValue)} className="spool-field">
            {RULE_CATEGORIES.map((item) => <option key={item} value={item}>{item.replaceAll("_", " ")}</option>)}
          </select>
        </label>
        <label className="block space-y-1">
          <span className="text-sm font-medium text-ink">Mode</span>
          <select value={mode} onChange={(event) => setMode(event.target.value as RuleModeValue)} className="spool-field">
            {RULE_MODES.map((item) => <option key={item} value={item}>{item.replaceAll("_", " ")}</option>)}
          </select>
        </label>
        <label className="block space-y-1">
          <span className="text-sm font-medium text-ink">Target</span>
          <select value={target} onChange={(event) => setTarget(event.target.value as RuleTargetValue)} className="spool-field">
            {RULE_TARGETS.map((item) => <option key={item} value={item}>{item.replaceAll("_", " ")}</option>)}
          </select>
        </label>
      </div>
      {mode === "banned_phrase" ? (
        <label className="block space-y-1">
          <span className="text-sm font-medium text-ink">Banned phrases</span>
          <textarea value={phrases} onChange={(event) => setPhrases(event.target.value)} className="min-h-20 spool-field" />
        </label>
      ) : null}
      {error ? <p className="text-sm text-weak">{error}</p> : null}
      <button type="submit" disabled={loading} className="spool-button disabled:opacity-60">{loading ? "Creating..." : "Create rule"}</button>
    </form>
  );
}
```

- [ ] **Step 5: Create the rule list**

Create `components/rules/RuleList.tsx`:

```tsx
"use client";

import { useMemo, useState } from "react";
import { RULE_CATEGORIES, RULE_MODES, type RuleBankRuleInput, type RuleCategoryValue, type RuleModeValue } from "@/lib/rules/types";

export function RuleList({
  rules,
  selectedRuleIds,
  onSelectionChange,
}: {
  rules: RuleBankRuleInput[];
  selectedRuleIds: string[];
  onSelectionChange: (ruleId: string, selected: boolean) => void;
}) {
  const [category, setCategory] = useState<RuleCategoryValue | "all">("all");
  const [mode, setMode] = useState<RuleModeValue | "all">("all");
  const [selectedOnly, setSelectedOnly] = useState(false);
  const selected = new Set(selectedRuleIds);
  const visibleRules = useMemo(
    () =>
      rules.filter((rule) => {
        if (category !== "all" && rule.category !== category) return false;
        if (mode !== "all" && rule.mode !== mode) return false;
        if (selectedOnly && !selected.has(rule.id)) return false;
        return true;
      }),
    [category, mode, rules, selectedOnly, selectedRuleIds],
  );

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-3">
        <label className="block space-y-1">
          <span className="text-sm font-medium text-ink">Category</span>
          <select aria-label="Category" value={category} onChange={(event) => setCategory(event.target.value as RuleCategoryValue | "all")} className="spool-field">
            <option value="all">All categories</option>
            {RULE_CATEGORIES.map((item) => <option key={item} value={item}>{item.replaceAll("_", " ")}</option>)}
          </select>
        </label>
        <label className="block space-y-1">
          <span className="text-sm font-medium text-ink">Mode</span>
          <select aria-label="Mode" value={mode} onChange={(event) => setMode(event.target.value as RuleModeValue | "all")} className="spool-field">
            <option value="all">All modes</option>
            {RULE_MODES.map((item) => <option key={item} value={item}>{item.replaceAll("_", " ")}</option>)}
          </select>
        </label>
        <label className="flex items-end gap-2 pb-2 text-sm text-ink">
          <input type="checkbox" checked={selectedOnly} onChange={(event) => setSelectedOnly(event.target.checked)} />
          Selected only
        </label>
      </div>
      <div className="space-y-3">
        {visibleRules.map((rule) => {
          const checked = selected.has(rule.id);
          return (
            <article key={rule.id} className="spool-plate-soft p-4">
              <div className="flex items-start gap-3">
                <input
                  aria-label={`Select ${rule.title}`}
                  type="checkbox"
                  checked={checked}
                  onChange={(event) => onSelectionChange(rule.id, event.target.checked)}
                  className="mt-1"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-semibold text-ink">{rule.title}</h3>
                    <span className="spool-stamp">{rule.mode.replaceAll("_", " ")}</span>
                    <span className="border border-line bg-light px-2 py-1 text-xs text-muted">{rule.category.replaceAll("_", " ")}</span>
                    <span className="border border-line bg-light px-2 py-1 text-xs text-muted">{rule.source}</span>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-muted">{rule.body}</p>
                </div>
              </div>
            </article>
          );
        })}
        {visibleRules.length === 0 ? <p className="spool-plate-soft p-4 text-sm text-muted">No rules match these filters.</p> : null}
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Create client orchestration components**

Create `components/rules/BrandRulesClient.tsx`:

```tsx
"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { RuleForm } from "@/components/rules/RuleForm";
import { RuleList } from "@/components/rules/RuleList";
import type { RuleBankRuleInput } from "@/lib/rules/types";

type BrandRuleSelectionView = {
  ruleId: string;
  selected: boolean;
  overrideJson?: string | null;
};

type RuleApplicationView = {
  id: string;
  status: string;
  baseSkillFileVersion: string;
  appliedAt?: string | Date | null;
  createdAt?: string | Date | null;
};

type LatestSkillFileView = {
  id: string;
  version: string;
  createdAt?: string | Date;
} | null;

type PreviewState = {
  preview: { id: string };
  compiled: {
    items: string[];
    nextSkillFile?: { version?: string };
    patch?: {
      linguisticRules?: string[];
      avoidedPhrases?: string[];
      skillRules?: unknown[];
      retrievalHints?: {
        preferredTopics?: string[];
        preferredStructures?: string[];
        preferredVocabulary?: string[];
        avoidVocabulary?: string[];
      };
    };
  };
};

export function BrandRulesClient({
  brandId,
  initialRules,
  initialSelections,
  applications,
  latestSkillFile,
}: {
  brandId: string;
  initialRules: RuleBankRuleInput[];
  initialSelections: BrandRuleSelectionView[];
  applications: RuleApplicationView[];
  latestSkillFile: LatestSkillFileView;
}) {
  const [rules, setRules] = useState(initialRules);
  const [selectedRuleIds, setSelectedRuleIds] = useState(() => initialSelections.filter((selection) => selection.selected).map((selection) => selection.ruleId));
  const [preview, setPreview] = useState<PreviewState | null>(null);
  const [appliedVersion, setAppliedVersion] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState("");
  const selectedCount = selectedRuleIds.length;

  const applicationItems = useMemo(
    () =>
      applications.map((application) => ({
        ...application,
        label: `${application.status.toLowerCase()} against ${application.baseSkillFileVersion}`,
      })),
    [applications],
  );

  async function saveSelection(ruleId: string, selected: boolean) {
    const nextSelected = selected ? Array.from(new Set([...selectedRuleIds, ruleId])) : selectedRuleIds.filter((id) => id !== ruleId);
    setSelectedRuleIds(nextSelected);
    setPreview(null);
    setAppliedVersion("");
    setError("");

    const response = await fetch(`/api/brands/${brandId}/rules/selections`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ selections: [{ ruleId, selected }] }),
    });
    const json = await response.json();
    if (!response.ok) {
      setSelectedRuleIds(selectedRuleIds);
      setError(json.error || "Could not save rule selection.");
    }
  }

  async function previewRules() {
    setLoading("preview");
    setError("");
    setAppliedVersion("");
    const response = await fetch(`/api/brands/${brandId}/rules/preview`, { method: "POST" });
    const json = await response.json();
    setLoading("");
    if (!response.ok) {
      setError(json.error || "Could not preview rules.");
      return;
    }
    setPreview(json);
  }

  async function applyRules() {
    if (!preview?.preview.id) return;
    setLoading("apply");
    setError("");
    const response = await fetch(`/api/brands/${brandId}/rules/apply`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ previewId: preview.preview.id }),
    });
    const json = await response.json();
    setLoading("");
    if (!response.ok) {
      setError(json.error || "Could not apply rules.");
      return;
    }
    setAppliedVersion(json.skillFile?.version || preview.compiled.nextSkillFile?.version || "");
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
      <section className="space-y-4">
        <RuleForm brandId={brandId} onCreated={(rule) => setRules((current) => [rule, ...current])} />
        <RuleList rules={rules} selectedRuleIds={selectedRuleIds} onSelectionChange={saveSelection} />
      </section>

      <aside className="h-fit space-y-4 spool-plate p-5">
        <div>
          <p className="text-xs font-semibold uppercase text-muted">Selection</p>
          <h2 className="mt-1 text-xl font-semibold text-ink">{selectedCount} selected</h2>
          <p className="mt-2 text-sm leading-6 text-muted">
            {latestSkillFile ? `Preview against ${latestSkillFile.version}.` : "Create a Skill File before previewing or applying rules."}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={previewRules} disabled={!latestSkillFile || selectedCount === 0 || loading !== ""} className="spool-button disabled:opacity-60">
            {loading === "preview" ? "Previewing..." : "Preview"}
          </button>
          <button type="button" onClick={applyRules} disabled={!preview || loading !== ""} className="spool-button-secondary disabled:opacity-60">
            {loading === "apply" ? "Applying..." : "Apply to Skill File"}
          </button>
        </div>

        {error ? <p className="text-sm text-weak">{error}</p> : null}

        {preview ? (
          <div className="spool-plate-soft p-4">
            <p className="text-xs font-semibold uppercase text-muted">Preview</p>
            <h3 className="mt-1 font-semibold text-ink">Next version {preview.compiled.nextSkillFile?.version || "ready"}</h3>
            <ul className="mt-3 space-y-2 text-sm leading-6 text-muted">
              {preview.compiled.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            {preview.compiled.items.length === 0 ? <p className="mt-2 text-sm text-muted">No new Skill File changes from the current selection.</p> : null}
          </div>
        ) : null}

        {appliedVersion ? (
          <div className="spool-plate-soft p-4">
            <p className="text-sm font-medium text-good">Applied {appliedVersion}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Link href={`/brands/${brandId}/skill-file`} className="spool-button-secondary text-sm">Open Skill File</Link>
              <Link href={`/brands/${brandId}/studio`} className="spool-button text-sm">Open Studio</Link>
            </div>
          </div>
        ) : null}

        {applicationItems.length ? (
          <div className="spool-plate-soft p-4">
            <p className="text-xs font-semibold uppercase text-muted">Recent applications</p>
            <ul className="mt-2 space-y-2 text-sm text-muted">
              {applicationItems.map((application) => (
                <li key={application.id}>{application.label}</li>
              ))}
            </ul>
          </div>
        ) : null}
      </aside>
    </div>
  );
}
```

Create `components/rules/GlobalRulesClient.tsx`:

```tsx
"use client";

import { useState } from "react";
import { RuleForm } from "@/components/rules/RuleForm";
import { RuleList } from "@/components/rules/RuleList";
import type { RuleBankRuleInput } from "@/lib/rules/types";

export function GlobalRulesClient({ initialRules }: { initialRules: RuleBankRuleInput[] }) {
  const [rules, setRules] = useState(initialRules);

  return (
    <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
      <RuleForm onCreated={(rule) => setRules((current) => [rule, ...current])} />
      <section className="space-y-4">
        <div className="spool-plate-soft p-4">
          <p className="text-xs font-semibold uppercase text-muted">Global rules</p>
          <p className="mt-1 text-sm leading-6 text-muted">Starter and custom global rules are managed here. Apply them from a brand Rules Bank page.</p>
        </div>
        <RuleList rules={rules} selectedRuleIds={[]} onSelectionChange={() => undefined} />
      </section>
    </div>
  );
}
```

- [ ] **Step 7: Run component tests**

Run:

```bash
npm test -- tests/rules/ruleComponents.test.tsx
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add package.json package-lock.json components/rules tests/rules/ruleComponents.test.tsx
git commit -m "feat: add rules bank ui components"
```

## Task 7: Add Rules Pages And Existing Page Links

**Files:**
- Create: `app/rules/page.tsx`
- Create: `app/brands/[brandId]/rules/page.tsx`
- Modify: `app/brands/[brandId]/page.tsx`
- Modify: `app/brands/[brandId]/skill-file/page.tsx`

- [ ] **Step 1: Add global rules page**

Create `app/rules/page.tsx`:

```tsx
import { GlobalRulesClient } from "@/components/rules/GlobalRulesClient";
import { PageHeader } from "@/components/ui/PageHeader";
import { prisma } from "@/lib/db";
import { listGlobalRules } from "@/lib/rules/ruleBankService";

export const dynamic = "force-dynamic";

export default async function RulesPage() {
  const rules = await listGlobalRules({ prisma });
  return (
    <div className="space-y-8">
      <PageHeader title="Rules Bank" description="Reusable starter and custom rules for hardening Skill Files." />
      <GlobalRulesClient initialRules={rules} />
    </div>
  );
}
```

- [ ] **Step 2: Add brand rules page**

Create `app/brands/[brandId]/rules/page.tsx`:

```tsx
import Link from "next/link";
import { notFound } from "next/navigation";
import { BrandRulesClient } from "@/components/rules/BrandRulesClient";
import { PageHeader } from "@/components/ui/PageHeader";
import { prisma } from "@/lib/db";
import { listApplicableBrandRules } from "@/lib/rules/ruleBankService";

export const dynamic = "force-dynamic";

export default async function BrandRulesPage({ params }: { params: Promise<{ brandId: string }> }) {
  const { brandId } = await params;
  const brand = await prisma.brand.findUnique({ where: { id: brandId }, select: { id: true, name: true } });
  if (!brand) notFound();
  const data = await listApplicableBrandRules({ prisma, brandId });

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow={brand.name}
        title="Rules Bank"
        description="Select reusable rules, preview the Skill File patch, then apply one hardening version."
        actions={
          <>
            <Link href={`/brands/${brand.id}/skill-file`} className="spool-button-secondary text-sm">Skill File</Link>
            <Link href={`/brands/${brand.id}`} className="spool-button-secondary text-sm">Brand dashboard</Link>
          </>
        }
      />
      <BrandRulesClient brandId={brand.id} initialRules={data.rules} initialSelections={data.selections} applications={data.applications} latestSkillFile={data.latestSkillFile} />
    </div>
  );
}
```

- [ ] **Step 3: Add brand dashboard link**

In `app/brands/[brandId]/page.tsx`, add this item to the `actions` array:

```ts
{ href: `/brands/${brand.id}/rules`, label: "Rules Bank" },
```

- [ ] **Step 4: Add Skill File page action and recent applications**

In `app/brands/[brandId]/skill-file/page.tsx`, include recent applications in the brand query:

```ts
include: {
  skillFiles: { orderBy: { createdAt: "desc" }, take: 2 },
  ruleApplications: { orderBy: { createdAt: "desc" }, take: 5 },
},
```

Add an action next to Brand dashboard:

```tsx
<Link href={`/brands/${brand.id}/rules`} className="spool-button-secondary text-sm">
  Rules Bank
</Link>
```

Under the Skill File health block, render recent applied batches:

```tsx
{brand.ruleApplications.length ? (
  <div className="spool-plate-soft p-4">
    <p className="text-xs font-semibold uppercase text-muted">Recent rule applications</p>
    <ul className="mt-2 space-y-2 text-sm text-muted">
      {brand.ruleApplications.map((application) => (
        <li key={application.id}>
          {application.status.toLowerCase()} against {application.baseSkillFileVersion}
          {application.appliedAt ? ` on ${application.appliedAt.toLocaleDateString()}` : ""}
        </li>
      ))}
    </ul>
  </div>
) : null}
```

- [ ] **Step 5: Run type and targeted tests**

Run:

```bash
npm test -- tests/rules
npx prisma validate
```

Expected: tests pass and Prisma validates.

- [ ] **Step 6: Commit**

```bash
git add app/rules app/brands/[brandId]/rules app/brands/[brandId]/page.tsx app/brands/[brandId]/skill-file/page.tsx
git commit -m "feat: add rules bank pages"
```

## Task 8: Full Verification

**Files:**
- No new files.

- [ ] **Step 1: Run all tests**

Run:

```bash
npm test
```

Expected: all Vitest tests pass.

- [ ] **Step 2: Validate Prisma**

Run:

```bash
npx prisma validate
```

Expected: Prisma schema validates.

- [ ] **Step 3: Generate Prisma client**

Run:

```bash
npx prisma generate
```

Expected: Prisma Client generated successfully.

- [ ] **Step 4: Build**

Run:

```bash
npm run build
```

Expected: Next build exits with code 0.

- [ ] **Step 5: Start dev server and browser-check the flow**

Run:

```bash
npm run dev
```

Expected: local server starts. Open `http://127.0.0.1:3000`, navigate to a brand, open Rules Bank, select a starter rule, preview, apply, and confirm the Skill File page shows the new version.

- [ ] **Step 6: Commit final verification fixes**

If verification required any fixes, commit them:

```bash
git add .
git commit -m "fix: complete rules bank verification"
```

If no files changed, do not create an empty commit.

## Self-Review Checklist

- Spec coverage: Tasks cover schema, starter rules, custom rules, brand selections, preview, apply, application history, global page, brand page, Skill File links, seed, tests, and verification.
- Placeholder scan: This plan contains no red-flag markers and no unspecified implementation steps.
- Type consistency: Rule taxonomy names in `types.ts`, `starterRules.ts`, compiler tests, service tests, and UI tests all use lower-case app values; Prisma stores uppercase enum identifiers mapped to lower-case database values.
- UI coverage: Task 6 gives complete component bodies for the reusable list, form, brand orchestration, and global orchestration components.
