# World-Class Voice System Upgrade Design

Date: 2026-04-25

## Goal

Upgrade Voice Skill File for Twitter/X from a working first version into a product-grade voice replication system.

The product should no longer behave like a generic tweet generator with a prompt attached. It should behave like a voice intelligence system:

1. Ingest a brand's past writing with formatting intact.
2. Build a deterministic corpus profile from the full sample set.
3. Ask a strong model to infer higher-level voice rules from evidence.
4. Create a reusable, evidence-backed Voice Skill File.
5. Retrieve relevant real examples before generation.
6. Generate more candidates than the user requested.
7. Evaluate and rerank candidates before showing them.
8. Learn from feedback by updating rules, examples, and confidence.

Claude Sonnet 4.6 is the default quality model when an Anthropic key is available. Local models remain supported, but they are treated as draft or privacy modes rather than the quality ceiling.

## Product Positioning

This is not "AI tweets." The core asset is the Voice Skill File.

The product promise is:

> Upload your past writing. Get a reusable Voice Skill File. Generate tweets that sound like you, with evidence and feedback behind every improvement.

The app should feel production-upgradable, even if the current codebase still runs as a single Next.js app with Prisma. This means clean boundaries, durable data shapes, explicit model behavior, and UX that moves the user through the voice workflow without dead ends.

This upgrade should avoid local-only assumptions in the product language and architecture. Local SQLite, localStorage provider keys, and LM Studio are acceptable development/runtime options, but the product design should be ready to move to hosted Postgres, encrypted secret storage, background jobs, and account-based workspaces later without rewriting the voice pipeline.

## Non-Goals

Do not add these in this upgrade:

- Twitter/X OAuth
- posting
- scheduling
- analytics dashboards
- competitor research
- trend monitoring
- billing
- subscriptions
- team collaboration
- LinkedIn, Instagram, or multi-platform support
- unofficial ChatGPT account automation

BYOK remains the supported provider model. OpenAI, Anthropic, OpenRouter, and OpenAI-compatible endpoints should stay supported, but Claude Sonnet 4.6 is the recommended high-quality default.

## Core Architecture

Keep the app as a modular Next.js product, but make the voice pipeline explicit.

Primary workflow:

```mermaid
flowchart LR
  Upload["Upload writing corpus"] --> Parse["Parse and clean samples"]
  Parse --> Profile["Corpus profile"]
  Profile --> Analyze["Claude voice analysis"]
  Analyze --> Skill["Evidence-backed Skill File"]
  Skill --> Retrieve["Retrieve relevant examples"]
  Retrieve --> Generate["Generate candidate pool"]
  Generate --> Evaluate["Evaluate and rerank"]
  Evaluate --> Studio["Show best drafts"]
  Studio --> Feedback["Collect feedback"]
  Feedback --> SkillV["Create next Skill File version"]
  SkillV --> Retrieve
```

Module boundaries:

- `lib/voice/corpusProfile.ts`: deterministic stats, phrase mining, formatting patterns, hooks, endings, and example selection.
- `lib/voice/selectExamples.ts`: retrieve examples by topic, tweet type, vocabulary, and structure.
- `lib/voice/analyzeVoice.ts`: orchestrate corpus profile plus LLM analysis.
- `lib/voice/createSkillFile.ts`: synthesize the Skill File from brand context, corpus profile, and voice report.
- `lib/voice/generateTweets.ts`: generate a larger candidate pool, evaluate, rerank, and return the strongest drafts.
- `lib/voice/evaluateTweet.ts`: hybrid deterministic and optional LLM evaluation.
- `lib/voice/updateSkillFileFromFeedback.ts`: update examples, rules, confidence, and versions from feedback.
- `lib/llm/client.ts`: provider adapters, JSON reliability, model defaults, and error handling.
- `lib/llm/prompts/*`: prompts are thin wrappers around structured input and output contracts.

No single voice module should become a giant "do everything" file. Each unit should have clear inputs, outputs, and tests.

Deployment posture:

- The voice pipeline should be pure TypeScript modules callable from route handlers, jobs, or future workers.
- Database reads and writes should stay at the route/workflow layer, not inside low-level scoring utilities.
- Long-running analysis/generation should remain synchronous for this implementation pass, but function boundaries should make a future background-job move straightforward.
- Provider configuration should flow through request-scoped objects, so hosted secret storage can replace browser-sent keys later.

## Model Strategy

Use a model tier system.

Quality mode:

- Provider: Anthropic
- Default model: Claude Sonnet 4.6
- Used for: voice analysis, Skill File synthesis, generation, and LLM evaluation.

Strong alternate providers:

- OpenAI
- OpenRouter
- OpenAI-compatible endpoints with capable models

Draft/privacy mode:

- Local LM Studio models such as Gemma 4 E2B/E4B
- Used for smoke testing, privacy-first local drafting, and offline workflows.
- Not presented as the benchmark for final quality.

Provider settings:

- API keys must not be persisted in SQLite.
- `.env.local` can provide server-side development keys.
- Browser localStorage can provide a session/provider key sent only with analyze/generate/evaluate requests.
- The UI should show which mode is active: `Quality`, `Alternate`, `Local Draft`, or `Mock`.

Context strategy:

- High-context models get a richer direct analysis package.
- Lower-context models receive compressed corpus packets and smaller example sets.
- Deterministic corpus stats are always authoritative for mechanics such as line breaks, average length, emoji rate, capitalization, and punctuation.

## Corpus Profile

The corpus profile is deterministic and computed from useful content samples before any LLM call.

It should include:

- total useful samples
- average, median, p25, p75, and p90 tweet length
- line break rate and common line break templates
- emoji frequency and common emojis
- punctuation profile
- capitalization profile
- first-person and second-person usage
- URL, mention, hashtag, and CTA rates
- repeated phrases and n-grams
- common hooks
- common endings
- common topics and vocabulary
- reply, thread, announcement, educational, opinion, and CTA pattern estimates
- top representative examples
- examples to avoid for learning if noisy or off-pattern

The corpus profile should preserve exact tweet formatting in examples. Newlines, blank lines, bullets, numbering, and spacing are voice signals.

## Voice Report

The Voice Report should become evidence-backed.

Keep the current top-level report shape for compatibility, but extend it with optional fields that can power better UI and Skill File synthesis:

```ts
type Evidence = {
  quote: string;
  reason: string;
};

type VoiceRuleEvidence = {
  rule: string;
  confidence: number;
  evidence: Evidence[];
};
```

The LLM prompt should ask Claude to:

- infer only from the corpus profile and supplied examples
- distinguish stable voice traits from campaign-specific language
- identify formatting mechanics, not just adjectives
- identify "this, not that" contrasts
- identify situations where the brand can sound different by tweet type
- return strict JSON
- avoid generic "AI copywriter" language

If the LLM returns malformed JSON, the app should repair or normalize it. If repair fails, the app should return a useful error in the UI rather than crashing.

## Voice Skill File 2.0

The Skill File remains the core artifact. It should support the existing structure but gain more operational detail.

Add these optional fields while preserving backward compatibility:

```ts
type SkillRule = {
  id: string;
  layer: "identity" | "mechanics" | "context" | "examples" | "feedback";
  rule: string;
  confidence: number;
  supportingExamples: string[];
  counterExamples: string[];
  appliesTo: string[];
};

type VoiceSkillFileV2 = VoiceSkillFile & {
  schemaVersion: "2.0";
  modelNotes: {
    preferredQualityModel: string;
    generatedWith?: string;
    corpusSampleCount: number;
  };
  corpusProfile: Record<string, unknown>;
  rules: SkillRule[];
  retrievalHints: {
    preferredTopics: string[];
    preferredStructures: string[];
    preferredVocabulary: string[];
    avoidVocabulary: string[];
  };
};
```

The existing JSON editor can still display the full file, but the UI should summarize the parts users care about:

- voice summary
- strongest rules
- preferred structures
- banned phrases
- approved examples
- rejected examples
- latest version

Manual edits and feedback updates continue to create new immutable `SkillFile` rows.

## Example Retrieval

Generation should never rely only on the Skill File.

Before generation, retrieve examples using a deterministic scorer:

- topic overlap with the user's idea
- tweet type match
- phrase/vocabulary overlap
- format match, such as single-line, list, announcement, reply, or thread-like formatting
- quality score
- approval status from feedback

Approved generated examples should receive a boost. Rejected examples should never be used as positive examples, but they can be passed as counterexamples when useful.

This avoids the "generic but polished" failure mode because every generation call is grounded in real voice evidence.

## Candidate Generation

When the user asks for `n` variations, generate an internal pool larger than `n`.

Default:

- requested 1 to 3: generate 8 candidates internally
- requested 4 to 6: generate 12 candidates internally
- requested 7 to 10: generate 16 candidates internally

The user only sees the top requested count after evaluation and reranking.

The generation prompt should include:

- brand context
- compact Skill File summary
- top rules with confidence
- relevant on-brand examples
- relevant counterexamples when available
- tweet type-specific rules
- anti-slop rules
- banned phrases
- factuality constraints
- formatting constraints
- user context and optional notes

The model must not invent metrics, customer names, dates, partnerships, product claims, or results.

## Evaluation and Reranking

Every candidate should be evaluated before display.

The evaluator returns:

- score out of 100
- score label
- component scores
- reason
- detected issues
- suggested revision direction
- whether it should be shown

Component weights:

- brand voice match: 35
- Twitter nativeness: 20
- specificity: 15
- hook quality: 10
- non-generic quality: 10
- CTA/context fit: 5
- safety/factuality: 5

Deterministic checks should catch:

- banned phrases
- too long for single tweet
- invented numeric claims
- generic AI phrases
- unnecessary hashtags
- line break mismatch
- missing context words
- weak hooks
- over-polished launch language

Claude evaluation should be used in quality mode. In local draft or mock mode, heuristic evaluation is acceptable but the UI should label it honestly.

Weak candidates can be shown only if there are not enough strong candidates, and they must be visibly marked as weak.

## Feedback Learning

Feedback should change the Skill File in structured ways.

For positive feedback:

- Add the generated tweet to `approvedGenerated`.
- Add or increase confidence for rules it follows.
- Boost similar examples in retrieval.

For negative feedback:

- Add the generated tweet to `rejectedGenerated`.
- Add or increase counterexamples.
- Add specific avoided phrases when present.
- Add a precise rule for the feedback label.
- Reduce confidence in rules that produced the bad draft, when identifiable.

Feedback labels map to structured updates:

- `Too generic`: prefer concrete nouns, sharper claims, specific examples, and fewer abstract benefits.
- `Too formal`: use plainer conversational phrasing.
- `Too casual`: preserve credibility and avoid throwaway phrasing.
- `Too salesy`: lead with evidence or observation before CTA.
- `Too polished`: avoid corporate announcement language.
- `Too long`: compress and preserve only necessary clauses.
- `Too much hype`: remove superlatives and inflated claims.
- `Wrong vocabulary`: add comment terms to avoided vocabulary.
- `Good idea, wrong tone`: preserve idea but add draft as counterexample.
- `Good tone, weak hook`: strengthen first line patterns.
- `Sounds like us`: promote as approved example.

After feedback, the UI should offer:

- generate a better batch using the updated Skill File
- review what changed in the Skill File
- go back to the brand dashboard

## UX Flow

The product should have no dead ends.

Brand dashboard:

- Show current stage: Setup, Upload, Analyze, Skill File, Generate, Learn.
- Show latest Skill File version and quality mode.
- Show next best action.

Upload page:

- Preserve tweet formatting in previews.
- Allow deleting previous uploads and samples.
- After successful upload, primary CTA is `Analyze Voice`.

Voice report page:

- Show analysis sections.
- Primary CTA after analysis is `Review Skill File`.
- Secondary CTA is `Generate Tweets`.

Skill file page:

- Show a readable summary first, JSON editor second.
- Save creates new version.
- Primary CTA is `Open Tweet Studio`.

Tweet studio:

- Show active Skill File version and provider mode.
- Generate button explains how many final variations will be shown.
- Draft cards show score, label, reason, and issues.
- Feedback panel offers an obvious next action after submission.

Provider settings:

- Make Claude Sonnet 4.6 the recommended default when Anthropic is selected.
- Explain local models as privacy/draft mode.
- Never store keys in SQLite.

## Error Handling

Model errors must be explicit and recoverable.

Rules:

- API failures return JSON with a useful message.
- UI reads response bodies safely even when the server returns an empty or non-JSON response.
- Malformed model JSON is repaired or normalized where possible.
- If repair fails, the UI tells the user which step failed and how to retry.
- Local model limitations should be described as model limitations, not app failures.

## Tests

Add focused tests for:

- corpus profile metrics
- formatting preservation in corpus examples
- example retrieval scoring
- Skill File v2 creation
- candidate pool sizing
- reranking behavior
- evaluator component scoring
- feedback rule updates
- Anthropic default model selection
- safe JSON response handling in analyze/generate routes

Existing parser, cleaner, classifier, skill file, and feedback tests should continue to pass.

## Acceptance Criteria

The upgrade is complete when:

- Anthropic/Claude Sonnet 4.6 is the recommended quality model.
- The app clearly distinguishes quality mode, local draft mode, mock mode, and alternate provider mode.
- Voice analysis uses deterministic corpus profiling plus LLM analysis.
- The Skill File includes evidence-backed rules and model/corpus metadata.
- Generation retrieves relevant examples before calling the model.
- Generation creates a larger internal candidate pool and only shows reranked results.
- Evaluation includes component scores and clear reasons.
- Feedback updates the Skill File with structured examples, rules, and confidence.
- The UI has clear next actions after upload, analysis, skill review, generation, and feedback.
- The app does not crash on malformed LLM JSON or empty API responses.
- All tests and production build pass.

## Implementation Notes

Prioritize the voice pipeline over visual polish.

The first implementation pass should focus on:

1. Provider/model defaults and mode labels.
2. Corpus profile module.
3. Skill File v2 shape and creation.
4. Retrieval.
5. Candidate generation plus reranking.
6. Hybrid evaluation.
7. Feedback learning improvements.
8. UX next-action polish.

Keep schema changes minimal unless a new table is clearly necessary. Prefer adding backward-compatible JSON fields to the existing `SkillFile.skillJson` first.
