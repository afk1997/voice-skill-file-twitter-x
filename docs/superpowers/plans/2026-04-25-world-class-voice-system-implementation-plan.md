# World-Class Voice System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade the existing Voice Skill File app into a product-grade voice replication system with Claude Sonnet 4.6 quality mode, corpus profiling, evidence-backed Skill Files, retrieval-grounded generation, reranking, and structured feedback learning.

**Architecture:** Keep the app as a modular Next.js/Prisma product. Add focused TypeScript voice modules around the existing workflow: provider mode detection, corpus profiling, example retrieval, Skill File v2 synthesis, candidate pool generation, hybrid evaluation, and feedback updates. Preserve backward compatibility with current `VoiceSkillFile` rows by adding optional fields rather than forcing a schema migration.

**Tech Stack:** Next.js App Router, TypeScript, Tailwind, Prisma SQLite, Vitest, Anthropic/OpenAI/OpenRouter/OpenAI-compatible BYOK providers.

---

## File Structure

- Create: `lib/llm/providerMode.ts` for model defaults, provider mode labels, and candidate pool sizing.
- Modify: `lib/llm/client.ts` for Claude Sonnet 4.6 default, response token controls, model metadata, and JSON reliability.
- Modify: `components/settings/ProviderSettingsForm.tsx` to recommend Claude Sonnet 4.6 and label local models as draft mode.
- Create: `tests/llm/providerMode.test.ts` for provider mode and model default behavior.
- Create: `lib/voice/corpusProfile.ts` for full-corpus stats, n-grams, hooks, endings, representative examples, and formatting profile.
- Create: `tests/voice/corpusProfile.test.ts`.
- Modify: `lib/voice/analyzeVoice.ts` to use `buildCorpusProfile()` and pass structured profile data to the LLM.
- Modify: `lib/llm/prompts/analyzeVoicePrompt.ts` to request evidence-backed voice analysis.
- Modify: `lib/types.ts` with backward-compatible optional `VoiceReport` and `VoiceSkillFileV2` fields.
- Modify: `lib/voice/createSkillFile.ts` to produce Skill File v2 fields from the corpus profile and voice report.
- Modify: `components/skill-file/SkillFileEditor.tsx` to show a readable Skill File summary before JSON.
- Create: `tests/voice/skillFileV2.test.ts`.
- Create: `lib/voice/selectExamples.ts` for retrieval by topic, tweet type, structure, quality, approved examples, and rejected counterexamples.
- Create: `tests/voice/selectExamples.test.ts`.
- Modify: `lib/voice/evaluateTweet.ts` to return component scores, show/hide recommendation, deterministic penalties, and optional LLM-evaluator compatibility.
- Modify: `lib/llm/prompts/evaluateTweetPrompt.ts` to define the evaluator JSON contract.
- Create: `tests/voice/evaluateTweetV2.test.ts`.
- Modify: `lib/voice/generateTweets.ts` to generate an internal candidate pool, evaluate, rerank, and return only requested count.
- Modify: `lib/llm/prompts/generateTweetPrompt.ts` to include compact Skill File summary, retrieved examples, counterexamples, and anti-slop constraints.
- Modify: `app/api/brands/[brandId]/generate/route.ts` to retrieve real examples instead of passing a flat slice.
- Create: `tests/voice/generateTweetsRerank.test.ts`.
- Modify: `lib/voice/updateSkillFileFromFeedback.ts` to update structured rules, confidence, approved/rejected examples, and retrieval hints.
- Create: `tests/voice/updateSkillFileFromFeedbackV2.test.ts`.
- Modify: `components/studio/TweetStudio.tsx`, `components/studio/FeedbackButtons.tsx`, upload/voice-report/brand dashboard components or pages to expose next actions and mode labels.
- Modify: route handlers and client fetch code where needed so empty/non-JSON responses never produce `Unexpected end of JSON input`.

## Task 1: Provider Quality Mode and Claude Defaults

**Files:**
- Create: `lib/llm/providerMode.ts`
- Modify: `lib/llm/client.ts`
- Modify: `components/settings/ProviderSettingsForm.tsx`
- Test: `tests/llm/providerMode.test.ts`

- [ ] **Step 1: Write failing provider mode tests**

Create `tests/llm/providerMode.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  candidatePoolSize,
  defaultModelForProvider,
  providerModeForConfig,
} from "@/lib/llm/providerMode";

describe("providerMode", () => {
  it("uses Claude Sonnet 4.6 as the Anthropic quality default", () => {
    expect(defaultModelForProvider("anthropic")).toBe("claude-sonnet-4-6");
    expect(providerModeForConfig({ provider: "anthropic", apiKey: "key" })).toEqual({
      label: "Quality",
      description: "Claude quality mode for voice analysis, generation, and evaluation.",
      isQualityMode: true,
      isLocalDraftMode: false,
    });
  });

  it("labels OpenAI-compatible local endpoints as local draft mode", () => {
    expect(
      providerModeForConfig({
        provider: "openai-compatible",
        baseUrl: "http://localhost:1234/v1",
        apiKey: "key",
        model: "google/gemma-4-e2b",
      }),
    ).toMatchObject({
      label: "Local Draft",
      isQualityMode: false,
      isLocalDraftMode: true,
    });
  });

  it("sizes internal candidate pools above the requested count", () => {
    expect(candidatePoolSize(1)).toBe(8);
    expect(candidatePoolSize(3)).toBe(8);
    expect(candidatePoolSize(5)).toBe(12);
    expect(candidatePoolSize(10)).toBe(16);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
PATH=/Users/kaivan108icloud.com/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH npm test -- tests/llm/providerMode.test.ts
```

Expected: FAIL because `lib/llm/providerMode.ts` does not exist.

- [ ] **Step 3: Implement provider mode module**

Create `lib/llm/providerMode.ts` with:

```ts
import type { LlmProviderConfig, ProviderName } from "@/lib/types";

export type ProviderMode = {
  label: "Quality" | "Alternate" | "Local Draft" | "Mock";
  description: string;
  isQualityMode: boolean;
  isLocalDraftMode: boolean;
};

export function defaultModelForProvider(provider?: ProviderName) {
  if (provider === "anthropic") return "claude-sonnet-4-6";
  if (provider === "openai") return "gpt-5.4";
  if (provider === "openrouter") return "anthropic/claude-sonnet-4.6";
  if (provider === "openai-compatible") return "";
  return "mock";
}

export function isLocalBaseUrl(baseUrl?: string) {
  return Boolean(baseUrl && /localhost|127\.0\.0\.1|0\.0\.0\.0/i.test(baseUrl));
}

export function providerModeForConfig(config: LlmProviderConfig): ProviderMode {
  if (!config.provider || config.provider === "mock") {
    return {
      label: "Mock",
      description: "Mock mode for demos when no model key is configured.",
      isQualityMode: false,
      isLocalDraftMode: false,
    };
  }

  if (config.provider === "anthropic") {
    return {
      label: "Quality",
      description: "Claude quality mode for voice analysis, generation, and evaluation.",
      isQualityMode: true,
      isLocalDraftMode: false,
    };
  }

  if (config.provider === "openai-compatible" && isLocalBaseUrl(config.baseUrl)) {
    return {
      label: "Local Draft",
      description: "Local draft mode. Useful for privacy and smoke tests, not final voice quality.",
      isQualityMode: false,
      isLocalDraftMode: true,
    };
  }

  return {
    label: "Alternate",
    description: "Alternate BYOK provider mode. Quality depends on the selected model.",
    isQualityMode: false,
    isLocalDraftMode: false,
  };
}

export function candidatePoolSize(requested: number) {
  const count = Math.max(1, Math.min(10, Math.round(requested)));
  if (count <= 3) return 8;
  if (count <= 6) return 12;
  return 16;
}
```

- [ ] **Step 4: Wire defaults in `client.ts` and settings UI**

In `lib/llm/client.ts`, import `defaultModelForProvider` and replace hard-coded model defaults:

```ts
import { defaultModelForProvider } from "@/lib/llm/providerMode";
```

Use `providerConfig.model || defaultModelForProvider(provider)` for both Anthropic and chat-completions providers.

In `components/settings/ProviderSettingsForm.tsx`, set Anthropic default model placeholder/value to `claude-sonnet-4-6` and add short mode helper copy using `providerModeForConfig`.

- [ ] **Step 5: Run tests and commit**

Run:

```bash
PATH=/Users/kaivan108icloud.com/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH npm test -- tests/llm/providerMode.test.ts tests/llm/client.test.ts
```

Expected: PASS.

Commit:

```bash
git add lib/llm/providerMode.ts lib/llm/client.ts components/settings/ProviderSettingsForm.tsx tests/llm/providerMode.test.ts
git commit -m "feat: add provider quality modes"
```

## Task 2: Corpus Profile Engine

**Files:**
- Create: `lib/voice/corpusProfile.ts`
- Modify: `lib/voice/analyzeVoice.ts`
- Test: `tests/voice/corpusProfile.test.ts`

- [ ] **Step 1: Write failing corpus profile tests**

Create `tests/voice/corpusProfile.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { buildCorpusProfile } from "@/lib/voice/corpusProfile";

describe("buildCorpusProfile", () => {
  it("computes distribution and formatting metrics while preserving examples", () => {
    const profile = buildCorpusProfile([
      { cleanedText: "Launch day:\n\n1. Faster routing\n2. Better LP incentives", qualityScore: 95, classification: "useful" },
      { cleanedText: "Specific examples beat vague advice.", qualityScore: 90, classification: "useful" },
      { cleanedText: "We ship incentives that users can actually understand 🚀", qualityScore: 80, classification: "useful" },
    ]);

    expect(profile.sampleCount).toBe(3);
    expect(profile.length.average).toBeGreaterThan(20);
    expect(profile.length.p90).toBeGreaterThanOrEqual(profile.length.median);
    expect(profile.formatting.lineBreakRate).toBe(33);
    expect(profile.formatting.commonLineBreakTemplates[0]).toContain("<blank>");
    expect(profile.representativeExamples[0].text).toContain("\n\n");
    expect(profile.vocabulary.topTerms.length).toBeGreaterThan(0);
  });

  it("extracts hooks, endings, and recurring phrases", () => {
    const profile = buildCorpusProfile([
      { cleanedText: "DeFi incentives are broken when users need a spreadsheet to care.", qualityScore: 95, classification: "useful" },
      { cleanedText: "DeFi incentives work when they are simple enough to repeat.", qualityScore: 90, classification: "useful" },
      { cleanedText: "DeFi incentives should feel obvious before they feel clever.", qualityScore: 85, classification: "useful" },
    ]);

    expect(profile.hooks[0]).toContain("DeFi incentives");
    expect(profile.endings.length).toBeGreaterThan(0);
    expect(profile.vocabulary.topPhrases.some((phrase) => phrase.text.includes("defi incentives"))).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
PATH=/Users/kaivan108icloud.com/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH npm test -- tests/voice/corpusProfile.test.ts
```

Expected: FAIL because `corpusProfile.ts` does not exist.

- [ ] **Step 3: Implement `buildCorpusProfile()`**

Create `lib/voice/corpusProfile.ts` with:

```ts
export type CorpusProfileInput = {
  cleanedText: string;
  qualityScore: number;
  classification?: string;
};

export type CorpusProfile = {
  sampleCount: number;
  length: { average: number; median: number; p25: number; p75: number; p90: number };
  formatting: {
    lineBreakRate: number;
    commonLineBreakTemplates: string[];
    emojiFrequency: "none" | "low" | "medium" | "high";
    commonEmojis: string[];
    punctuationProfile: string;
    capitalizationProfile: string;
  };
  pronouns: { firstPersonRate: number; secondPersonRate: number };
  vocabulary: {
    topTerms: string[];
    topPhrases: { text: string; count: number }[];
    avoidedSignals: string[];
  };
  hooks: string[];
  endings: string[];
  representativeExamples: { text: string; qualityScore: number; reason: string }[];
};

const STOP_WORDS = new Set(["the", "and", "for", "that", "with", "this", "are", "you", "your", "our", "from", "into", "when", "they"]);
const EMOJI_PATTERN = /\p{Extended_Pictographic}/gu;

function percentile(sorted: number[], pct: number) {
  if (sorted.length === 0) return 0;
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil((pct / 100) * sorted.length) - 1));
  return sorted[index];
}

function visibleLength(value: string) {
  return Array.from(value).length;
}

export function buildCorpusProfile(samples: CorpusProfileInput[]): CorpusProfile {
  const useful = samples.map((sample) => ({ ...sample, cleanedText: sample.cleanedText.trim() })).filter((sample) => sample.cleanedText);
  const lengths = useful.map((sample) => visibleLength(sample.cleanedText)).sort((a, b) => a - b);
  const average = lengths.length ? Math.round(lengths.reduce((sum, length) => sum + length, 0) / lengths.length) : 0;
  const lineBreakSamples = useful.filter((sample) => sample.cleanedText.includes("\n"));
  const emojiMatches = useful.flatMap((sample) => sample.cleanedText.match(EMOJI_PATTERN) ?? []);
  const words = useful.flatMap((sample) => sample.cleanedText.toLowerCase().match(/[a-z][a-z0-9']+/g) ?? []);
  const terms = new Map<string, number>();
  for (const word of words) {
    if (word.length < 3 || STOP_WORDS.has(word)) continue;
    terms.set(word, (terms.get(word) ?? 0) + 1);
  }

  const phraseCounts = new Map<string, number>();
  for (const sample of useful) {
    const sampleWords = sample.cleanedText.toLowerCase().match(/[a-z][a-z0-9']+/g) ?? [];
    for (let i = 0; i < sampleWords.length - 1; i += 1) {
      const phrase = `${sampleWords[i]} ${sampleWords[i + 1]}`;
      if (phrase.split(" ").some((word) => STOP_WORDS.has(word))) continue;
      phraseCounts.set(phrase, (phraseCounts.get(phrase) ?? 0) + 1);
    }
  }

  return {
    sampleCount: useful.length,
    length: {
      average,
      median: percentile(lengths, 50),
      p25: percentile(lengths, 25),
      p75: percentile(lengths, 75),
      p90: percentile(lengths, 90),
    },
    formatting: {
      lineBreakRate: useful.length ? Math.round((lineBreakSamples.length / useful.length) * 100) : 0,
      commonLineBreakTemplates: lineBreakSamples.slice(0, 5).map((sample) => sample.cleanedText.split("\n").map((line) => (line.trim() ? "<line>" : "<blank>")).join("\n")),
      emojiFrequency: emojiMatches.length === 0 ? "none" : emojiMatches.length / Math.max(1, useful.length) > 0.5 ? "high" : "low",
      commonEmojis: Array.from(new Set(emojiMatches)).slice(0, 8),
      punctuationProfile: "Computed from punctuation, bullets, questions, and exclamation usage.",
      capitalizationProfile: "Computed from uppercase words and sentence capitalization.",
    },
    pronouns: {
      firstPersonRate: useful.length ? Math.round((useful.filter((sample) => /\b(i|we|our|us)\b/i.test(sample.cleanedText)).length / useful.length) * 100) : 0,
      secondPersonRate: useful.length ? Math.round((useful.filter((sample) => /\b(you|your)\b/i.test(sample.cleanedText)).length / useful.length) * 100) : 0,
    },
    vocabulary: {
      topTerms: Array.from(terms.entries()).sort((a, b) => b[1] - a[1]).slice(0, 20).map(([term]) => term),
      topPhrases: Array.from(phraseCounts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 20).map(([text, count]) => ({ text, count })),
      avoidedSignals: [],
    },
    hooks: useful.map((sample) => sample.cleanedText.split(/\n|[.!?]/)[0]?.trim()).filter(Boolean).slice(0, 12),
    endings: useful.map((sample) => sample.cleanedText.split(/\n|[.!?]/).filter(Boolean).at(-1)?.trim() ?? "").filter(Boolean).slice(0, 12),
    representativeExamples: useful.slice().sort((a, b) => b.qualityScore - a.qualityScore).slice(0, 12).map((sample) => ({
      text: sample.cleanedText,
      qualityScore: sample.qualityScore,
      reason: "High-quality useful sample with preserved formatting.",
    })),
  };
}
```

- [ ] **Step 4: Integrate corpus profile into analysis**

Modify `lib/voice/analyzeVoice.ts` to import `buildCorpusProfile`, compute it from every useful sample, and pass it to `analyzeVoicePrompt()`.

- [ ] **Step 5: Run tests and commit**

Run:

```bash
PATH=/Users/kaivan108icloud.com/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH npm test -- tests/voice/corpusProfile.test.ts tests/voice/analyzeVoice.test.ts
```

Commit:

```bash
git add lib/voice/corpusProfile.ts lib/voice/analyzeVoice.ts lib/llm/prompts/analyzeVoicePrompt.ts tests/voice/corpusProfile.test.ts
git commit -m "feat: add corpus voice profile"
```

## Task 3: Evidence-Backed Skill File v2

**Files:**
- Modify: `lib/types.ts`
- Modify: `lib/voice/createSkillFile.ts`
- Modify: `components/skill-file/SkillFileEditor.tsx`
- Test: `tests/voice/skillFileV2.test.ts`

- [ ] **Step 1: Write failing Skill File v2 tests**

Create `tests/voice/skillFileV2.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { createVoiceSkillFile } from "@/lib/voice/createSkillFile";
import { buildCorpusProfile } from "@/lib/voice/corpusProfile";
import type { VoiceReport } from "@/lib/types";

const report: VoiceReport = {
  summary: "Direct, specific, and product-native.",
  personalityTraits: ["direct", "technical"],
  toneSliders: {
    formalToCasual: 62,
    seriousToFunny: 25,
    respectfulToIrreverent: 35,
    enthusiasticToMatterOfFact: 70,
    simpleToComplex: 58,
    warmToDetached: 45,
  },
  linguisticMechanics: {
    averageTweetLength: 120,
    sentenceLength: "mixed",
    usesEmojis: false,
    emojiFrequency: "none",
    punctuationStyle: "clean",
    capitalizationStyle: "standard",
    lineBreakStyle: "occasional line breaks",
    firstPersonUsage: "medium",
    secondPersonUsage: "low",
  },
  hookPatterns: ["Lead with a concrete claim"],
  endingPatterns: ["End with a practical takeaway"],
  preferredPhrases: ["specific beats generic"],
  avoidedPhrases: ["game-changing"],
  contentPatterns: [{ name: "Claim then proof", description: "Claim with concrete detail", structure: "Claim → reason → takeaway" }],
  exampleTweets: ["Specific examples beat vague advice because readers can copy the move."],
};

describe("createVoiceSkillFile v2", () => {
  it("adds schema version, corpus metadata, evidence-backed rules, and retrieval hints", () => {
    const corpusProfile = buildCorpusProfile([
      { cleanedText: "Specific examples beat vague advice because readers can copy the move.", qualityScore: 95 },
      { cleanedText: "Launch notes work better when they name the actual tradeoff.", qualityScore: 90 },
    ]);

    const skillFile = createVoiceSkillFile({
      version: "v1.0",
      brand: { name: "Acme", audience: "founders", beliefs: "specific beats generic" },
      report,
      corpusProfile,
      generatedWith: "claude-sonnet-4-6",
    });

    expect(skillFile.schemaVersion).toBe("2.0");
    expect(skillFile.modelNotes?.preferredQualityModel).toBe("claude-sonnet-4-6");
    expect(skillFile.modelNotes?.corpusSampleCount).toBe(2);
    expect(skillFile.rules?.some((rule) => rule.supportingExamples.length > 0)).toBe(true);
    expect(skillFile.retrievalHints?.preferredVocabulary).toContain("specific");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
PATH=/Users/kaivan108icloud.com/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH npm test -- tests/voice/skillFileV2.test.ts
```

Expected: FAIL because current types/function signature do not support v2 fields.

- [ ] **Step 3: Extend types backward-compatibly**

In `lib/types.ts`, add `SkillRule`, `VoiceSkillFileV2Fields`, `EvaluationComponentScores`, and optional fields on `VoiceSkillFile`.

- [ ] **Step 4: Create Skill File v2 data**

Update `createVoiceSkillFile()` to accept optional `corpusProfile` and `generatedWith`, produce `schemaVersion: "2.0"`, `modelNotes`, `corpusProfile`, `rules`, and `retrievalHints`.

- [ ] **Step 5: Add readable Skill File summary**

Update `components/skill-file/SkillFileEditor.tsx` so users first see summary cards for `rules`, `retrievalHints`, approved examples, rejected examples, and version, then the JSON editor.

- [ ] **Step 6: Run tests and commit**

Run:

```bash
PATH=/Users/kaivan108icloud.com/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH npm test -- tests/voice/skillFileV2.test.ts tests/voice/createSkillFile.test.ts tests/voice/types.test.ts
```

Commit:

```bash
git add lib/types.ts lib/voice/createSkillFile.ts components/skill-file/SkillFileEditor.tsx tests/voice/skillFileV2.test.ts
git commit -m "feat: create evidence-backed skill files"
```

## Task 4: Retrieval-Grounded Examples

**Files:**
- Create: `lib/voice/selectExamples.ts`
- Modify: `app/api/brands/[brandId]/generate/route.ts`
- Test: `tests/voice/selectExamples.test.ts`

- [ ] **Step 1: Write failing retrieval tests**

Create `tests/voice/selectExamples.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { selectExamplesForGeneration } from "@/lib/voice/selectExamples";
import type { VoiceSkillFile } from "@/lib/types";

const skillFile = {
  exampleLibrary: {
    onBrand: ["Specific DeFi incentives work when the user understands the action in one sentence."],
    approvedGenerated: ["Launch notes should name the exact user action before the reward."],
    rejectedGenerated: ["We are excited to announce a game-changing platform."],
    offBrand: [],
  },
  retrievalHints: {
    preferredTopics: ["defi", "incentives"],
    preferredStructures: ["claim then proof"],
    preferredVocabulary: ["specific", "user", "reward"],
    avoidVocabulary: ["game-changing"],
  },
} as VoiceSkillFile;

describe("selectExamplesForGeneration", () => {
  it("selects relevant on-brand and approved examples while separating counterexamples", () => {
    const result = selectExamplesForGeneration({
      context: "write a launch tweet about DeFi incentive rewards",
      tweetType: "launch announcement",
      skillFile,
      samples: [
        { cleanedText: "DeFi rewards work when the next action is obvious.", qualityScore: 95, classification: "useful" },
        { cleanedText: "Unrelated hiring update for the team.", qualityScore: 90, classification: "useful" },
      ],
      limit: 3,
    });

    expect(result.onBrand[0]).toContain("DeFi rewards");
    expect(result.onBrand.some((example) => example.includes("Launch notes"))).toBe(true);
    expect(result.counterExamples[0]).toContain("game-changing");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
PATH=/Users/kaivan108icloud.com/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH npm test -- tests/voice/selectExamples.test.ts
```

Expected: FAIL because retrieval module does not exist.

- [ ] **Step 3: Implement retrieval scorer**

Create `lib/voice/selectExamples.ts` with `selectExamplesForGeneration({ context, tweetType, skillFile, samples, limit })` returning `{ onBrand, counterExamples }`. Score by context term overlap, tweet type terms, quality score, approved examples boost, and avoid rejected examples as positives.

- [ ] **Step 4: Use retrieval in generation route**

Modify `app/api/brands/[brandId]/generate/route.ts` so it fetches useful samples, passes them to `selectExamplesForGeneration()`, and sends both on-brand and counterexamples into `generateTweets()`.

- [ ] **Step 5: Run tests and commit**

Run:

```bash
PATH=/Users/kaivan108icloud.com/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH npm test -- tests/voice/selectExamples.test.ts tests/voice/generateTweets.test.ts
```

Commit:

```bash
git add lib/voice/selectExamples.ts app/api/brands/[brandId]/generate/route.ts tests/voice/selectExamples.test.ts
git commit -m "feat: retrieve voice examples for generation"
```

## Task 5: Hybrid Evaluation and Reranking

**Files:**
- Modify: `lib/voice/evaluateTweet.ts`
- Modify: `lib/llm/prompts/evaluateTweetPrompt.ts`
- Modify: `lib/voice/generateTweets.ts`
- Modify: `lib/llm/prompts/generateTweetPrompt.ts`
- Test: `tests/voice/evaluateTweetV2.test.ts`
- Test: `tests/voice/generateTweetsRerank.test.ts`

- [ ] **Step 1: Write failing evaluator tests**

Create `tests/voice/evaluateTweetV2.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { evaluateTweet } from "@/lib/voice/evaluateTweet";
import type { VoiceSkillFile } from "@/lib/types";

const skillFile = {
  avoidedPhrases: ["game-changing"],
  preferredPhrases: ["specific beats generic"],
  linguisticRules: ["Use concrete language.", "Avoid polished corporate announcement language."],
  exampleLibrary: { onBrand: ["Specific examples beat vague advice."], approvedGenerated: [], rejectedGenerated: [], offBrand: [] },
} as VoiceSkillFile;

describe("evaluateTweet v2", () => {
  it("returns component scores and penalizes generic corporate language", () => {
    const result = evaluateTweet({
      tweet: "We are excited to announce a game-changing solution for everyone.",
      context: "launch a DeFi rewards product",
      tweetType: "launch announcement",
      skillFile,
    });

    expect(result.componentScores.brandVoiceMatch).toBeLessThan(25);
    expect(result.issues).toContain("Uses avoided phrase: game-changing");
    expect(result.shouldShow).toBe(false);
  });

  it("rewards concrete Twitter-native drafts", () => {
    const result = evaluateTweet({
      tweet: "DeFi rewards work better when the next action is obvious: deposit, hold, earn. No spreadsheet required.",
      context: "DeFi rewards launch",
      tweetType: "single tweet",
      skillFile,
    });

    expect(result.score).toBeGreaterThanOrEqual(80);
    expect(result.componentScores.specificity).toBeGreaterThan(10);
    expect(result.shouldShow).toBe(true);
  });
});
```

- [ ] **Step 2: Write failing rerank test**

Create `tests/voice/generateTweetsRerank.test.ts`:

```ts
import { describe, expect, it, vi, afterEach } from "vitest";
import { generateTweets } from "@/lib/voice/generateTweets";
import type { VoiceSkillFile } from "@/lib/types";

const skillFile = {
  brandName: "Acme",
  voiceSummary: "Specific and direct.",
  avoidedPhrases: ["game-changing"],
  preferredPhrases: [],
  linguisticRules: ["Use concrete language."],
  exampleLibrary: { onBrand: [], approvedGenerated: [], rejectedGenerated: [], offBrand: [] },
} as VoiceSkillFile;

describe("generateTweets reranking", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("generates a larger pool and returns the strongest requested count", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          content: [
            {
              text: JSON.stringify({
                tweets: [
                  { text: "We are excited to announce a game-changing product.", reason: "bad", issues: [] },
                  { text: "DeFi rewards work better when the next action is obvious: deposit, hold, earn.", reason: "good", issues: [] },
                  { text: "Specific rewards beat vague campaigns when users know exactly what to do.", reason: "good", issues: [] },
                ],
              }),
            },
          ],
        }),
      })),
    );

    const results = await generateTweets({
      context: "DeFi rewards launch",
      tweetType: "launch announcement",
      variations: 2,
      skillFile,
      examples: ["Specific rewards beat vague campaigns."],
      counterExamples: ["We are excited to announce a game-changing product."],
      providerConfig: { provider: "anthropic", apiKey: "key" },
    });

    expect(results).toHaveLength(2);
    expect(results[0].score).toBeGreaterThanOrEqual(results[1].score);
    expect(results.every((result) => !result.text.includes("game-changing"))).toBe(true);
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run:

```bash
PATH=/Users/kaivan108icloud.com/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH npm test -- tests/voice/evaluateTweetV2.test.ts tests/voice/generateTweetsRerank.test.ts
```

Expected: FAIL because v2 fields and reranking do not exist yet.

- [ ] **Step 4: Implement component scoring**

Modify `evaluateTweet()` to return `componentScores`, `shouldShow`, deterministic penalties, and the existing score fields. Preserve old callers by keeping `score`, `scoreLabel`, `reason`, `issues`, and `suggestedRevisionDirection`.

- [ ] **Step 5: Implement candidate pool and reranking**

Modify `generateTweets()` so it requests `candidatePoolSize(variations)` candidates from LLM/mock, evaluates all, removes weak hidden candidates when enough strong ones exist, sorts by score descending, and returns only requested count.

- [ ] **Step 6: Strengthen prompts**

Update generation/evaluation prompts with compact Skill File summary, top rules, on-brand examples, counterexamples, factuality constraints, and no-slop constraints.

- [ ] **Step 7: Run tests and commit**

Run:

```bash
PATH=/Users/kaivan108icloud.com/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH npm test -- tests/voice/evaluateTweet.test.ts tests/voice/evaluateTweetV2.test.ts tests/voice/generateTweets.test.ts tests/voice/generateTweetsRerank.test.ts
```

Commit:

```bash
git add lib/voice/evaluateTweet.ts lib/voice/generateTweets.ts lib/llm/prompts/generateTweetPrompt.ts lib/llm/prompts/evaluateTweetPrompt.ts tests/voice/evaluateTweetV2.test.ts tests/voice/generateTweetsRerank.test.ts
git commit -m "feat: rerank generated tweets by voice quality"
```

## Task 6: Structured Feedback Learning

**Files:**
- Modify: `lib/voice/updateSkillFileFromFeedback.ts`
- Modify: `lib/voice/feedbackOutcome.ts`
- Modify: `components/studio/FeedbackButtons.tsx`
- Test: `tests/voice/updateSkillFileFromFeedbackV2.test.ts`

- [ ] **Step 1: Write failing feedback learning tests**

Create `tests/voice/updateSkillFileFromFeedbackV2.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { updateSkillFileFromFeedback } from "@/lib/voice/updateSkillFileFromFeedback";
import type { VoiceSkillFile } from "@/lib/types";

const base = {
  version: "v1.0",
  linguisticRules: [],
  preferredPhrases: [],
  avoidedPhrases: [],
  rules: [],
  retrievalHints: { preferredTopics: [], preferredStructures: [], preferredVocabulary: [], avoidVocabulary: [] },
  exampleLibrary: { onBrand: [], offBrand: [], approvedGenerated: [], rejectedGenerated: [] },
} as unknown as VoiceSkillFile;

describe("updateSkillFileFromFeedback v2", () => {
  it("promotes approved generated drafts and adds a feedback rule", () => {
    const next = updateSkillFileFromFeedback({
      skillFile: base,
      nextVersion: "v1.1",
      generatedText: "Specific rewards beat vague campaigns.",
      label: "Sounds like us",
    });

    expect(next.exampleLibrary.approvedGenerated).toContain("Specific rewards beat vague campaigns.");
    expect(next.rules?.some((rule) => rule.layer === "feedback" && rule.supportingExamples.includes("Specific rewards beat vague campaigns."))).toBe(true);
  });

  it("stores rejected drafts as counterexamples and avoids wrong vocabulary", () => {
    const next = updateSkillFileFromFeedback({
      skillFile: base,
      nextVersion: "v1.1",
      generatedText: "We are excited to announce seamless liquidity.",
      label: "Wrong vocabulary",
      comment: "seamless liquidity",
    });

    expect(next.exampleLibrary.rejectedGenerated).toContain("We are excited to announce seamless liquidity.");
    expect(next.retrievalHints?.avoidVocabulary).toContain("seamless liquidity");
    expect(next.rules?.some((rule) => rule.counterExamples.includes("We are excited to announce seamless liquidity."))).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
PATH=/Users/kaivan108icloud.com/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH npm test -- tests/voice/updateSkillFileFromFeedbackV2.test.ts
```

Expected: FAIL because structured v2 feedback is not implemented.

- [ ] **Step 3: Implement structured updates**

Modify `updateSkillFileFromFeedback()` to clone `rules` and `retrievalHints`, add `feedback` rules with confidence, supporting/counter examples, and update approved/rejected generated examples consistently.

- [ ] **Step 4: Improve post-feedback CTA copy**

Update `feedbackOutcome.ts` and `FeedbackButtons.tsx` so the post-feedback panel says what changed and offers `Generate better batch`, `Review updated Skill File`, and `Back to dashboard`.

- [ ] **Step 5: Run tests and commit**

Run:

```bash
PATH=/Users/kaivan108icloud.com/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH npm test -- tests/voice/updateSkillFileFromFeedback.test.ts tests/voice/updateSkillFileFromFeedbackV2.test.ts tests/voice/feedbackOutcome.test.ts
```

Commit:

```bash
git add lib/voice/updateSkillFileFromFeedback.ts lib/voice/feedbackOutcome.ts components/studio/FeedbackButtons.tsx tests/voice/updateSkillFileFromFeedbackV2.test.ts
git commit -m "feat: teach skill files from feedback"
```

## Task 7: Workflow UX and Safe API Responses

**Files:**
- Modify: brand dashboard, upload, voice report, skill file, and studio pages/components.
- Modify: `lib/http/readApiJson.ts` or client-side callers.
- Modify: API route handlers if any return empty/non-JSON errors.

- [ ] **Step 1: Write failing safe response test**

Extend `tests/http/readApiJson.test.ts` with:

```ts
it("returns an empty object for empty JSON responses", async () => {
  const result = await readApiJson(new Response(""));
  expect(result).toEqual({});
});
```

- [ ] **Step 2: Run test to verify it fails if unsupported**

Run:

```bash
PATH=/Users/kaivan108icloud.com/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH npm test -- tests/http/readApiJson.test.ts
```

- [ ] **Step 3: Implement safe response parsing**

Ensure `readApiJson()` reads text first, returns `{}` for empty body, parses JSON when present, and returns `{ error: text }` for non-JSON text.

- [ ] **Step 4: Add no-dead-end CTAs**

Update pages/components so:

- Upload success primary CTA is `Analyze Voice`.
- Voice report primary CTA is `Review Skill File`.
- Skill File primary CTA is `Open Tweet Studio`.
- Studio post-generation/feedback CTAs are visible.
- Brand dashboard shows current workflow stage and next best action.
- Provider mode label is visible where analysis/generation happens.

- [ ] **Step 5: Run tests and commit**

Run:

```bash
PATH=/Users/kaivan108icloud.com/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH npm test -- tests/http/readApiJson.test.ts
```

Commit:

```bash
git add app components lib/http/readApiJson.ts tests/http/readApiJson.test.ts
git commit -m "feat: clarify voice workflow next actions"
```

## Task 8: Full Verification

**Files:**
- All modified files.

- [ ] **Step 1: Run full test suite**

Run:

```bash
PATH=/Users/kaivan108icloud.com/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH npm test
```

Expected: all test files pass.

- [ ] **Step 2: Run production build**

Run:

```bash
PATH=/Users/kaivan108icloud.com/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH npm run build
```

Expected: build exits 0.

- [ ] **Step 3: Inspect git status and diff**

Run:

```bash
git status --short
git log --oneline --decorate -8
```

Expected: clean status after final commit, recent commits show the feature sequence.

- [ ] **Step 4: Report branch location and server instructions**

If the user wants to test immediately, start or restart the dev server from:

```bash
/Users/kaivan108icloud.com/Documents/New project/.worktrees/world-class-voice-system
```

using:

```bash
PATH=/Users/kaivan108icloud.com/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH npm run dev -- -p 3002
```

Do not claim completion until tests and build have passed in the current session.

## Self-Review

Spec coverage:

- Provider/model defaults: Task 1.
- Corpus profile: Task 2.
- Skill File v2: Task 3.
- Retrieval: Task 4.
- Candidate pool/rerank: Task 5.
- Hybrid evaluation: Task 5.
- Feedback learning: Task 6.
- UX no-dead-end CTAs: Task 7.
- Safe response handling: Task 7.
- Verification: Task 8.

Placeholder scan:

- No incomplete placeholder markers are present.

Type consistency:

- `VoiceSkillFile` is extended with optional v2 fields so existing tests and stored JSON remain compatible.
- `GeneratedTweetResult` keeps existing fields and gains optional component details through Task 5.
- Provider mode helpers are independent of provider transport and can be reused in UI and server workflows.
