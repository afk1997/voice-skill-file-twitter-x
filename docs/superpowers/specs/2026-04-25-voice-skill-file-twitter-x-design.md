# Voice Skill File for Twitter/X Phase 1 Design

Date: 2026-04-25

## Goal

Build a working local MVP that turns a brand's past Twitter/X writing into a reusable Voice Skill File, then uses that file to generate and improve tweet drafts in the same voice.

The product is not a scheduler, analytics tool, competitor research product, trend monitor, or social posting tool. The core workflow is:

1. Create a brand workspace.
2. Upload Twitter/X archive files or tweet samples.
3. Parse, clean, classify, and store tweets.
4. Analyze useful tweets into a structured voice report.
5. Create a versioned Voice Skill File.
6. Generate tweet variations from ideas using that skill file.
7. Collect feedback and create improved skill file versions.

## Product Scope

The app is a single-user local MVP with no authentication. It will use a clean dashboard interface and keep the first screen focused on the voice workflow:

- `/`: product name, existing brand workspaces, and "Create Brand Voice Workspace" CTA.
- `/settings`: local BYOK provider settings.
- `/brands/new`: brand creation form.
- `/brands/[brandId]`: brand dashboard and workflow state.
- `/brands/[brandId]/upload`: upload center and ingestion summary.
- `/brands/[brandId]/voice-report`: readable voice analysis report.
- `/brands/[brandId]/skill-file`: latest skill file JSON editor.
- `/brands/[brandId]/studio`: tweet generation and feedback.

Out of scope for Phase 1:

- Twitter/X OAuth
- Posting
- Scheduling
- Analytics
- Competitor research
- Trend monitoring
- Team collaboration
- Billing or subscriptions
- Multi-platform support

## Architecture

Use a modular monolith:

- Next.js App Router for pages and route handlers.
- TypeScript throughout.
- Tailwind for styling.
- shadcn/ui if available in the scaffold.
- Prisma with SQLite for local development.
- Thin route handlers that validate input, call workflow modules, persist results, and return JSON.
- Testable domain modules under `lib/`.

Primary module boundaries:

- `lib/db.ts`: Prisma client.
- `lib/tweets/parseTwitterArchive.ts`: file and archive parsing.
- `lib/tweets/cleanTweet.ts`: tweet text normalization and cleanup.
- `lib/tweets/classifyTweet.ts`: classification and quality scoring.
- `lib/voice/analyzeVoice.ts`: voice report workflow.
- `lib/voice/createSkillFile.ts`: report-to-skill-file conversion.
- `lib/voice/evaluateTweet.ts`: deterministic scoring rubric.
- `lib/voice/updateSkillFileFromFeedback.ts`: deterministic version updates from user feedback.
- `lib/llm/client.ts`: provider-agnostic LLM facade.
- `lib/llm/prompts/analyzeVoicePrompt.ts`: shared analysis prompt.
- `lib/llm/prompts/generateTweetPrompt.ts`: shared generation prompt.
- `lib/llm/prompts/evaluateTweetPrompt.ts`: reserved for later LLM evaluation.

Upload, analysis, generation, and feedback are synchronous in Phase 1. The implementation will cap work so local SQLite and route handlers stay responsive.

## BYOK LLM Design

The MVP supports bring-your-own-key for:

- Anthropic
- OpenAI
- OpenRouter
- Generic OpenAI-compatible endpoints

API keys must not be persisted in SQLite. Provider settings work in two layers:

1. `.env.local` can provide default local development keys.
2. `/settings` stores provider, model, base URL, and API key in browser `localStorage`.

When the user runs analysis or generation, the browser sends the selected provider config with that request. The server uses the key only for the request. If no usable provider key exists, the app uses mock responses. If a real provider call fails, the app surfaces the provider error rather than silently falling back, so the user can fix the key/model/base URL.

The prompt content is provider-neutral. The client adapter handles transport differences.

## Data Model

Use the requested Prisma models:

- `Brand`
- `Upload`
- `ContentSample`
- `VoiceReportRecord`
- `SkillFile`
- `Generation`
- `Feedback`

Add one small model for non-secret local preferences only:

```prisma
model AppSetting {
  key       String   @id
  valueJson Json
  updatedAt DateTime @updatedAt
}
```

Do not store API keys in `AppSetting`.

Skill files are immutable records. Manual edits and feedback updates create new `SkillFile` rows. Version numbers start at `v1.0` and increment as `v1.1`, `v1.2`, and so on. The latest skill file is the newest row by `createdAt`.

`ContentSample.usedForVoice` is `true` only for samples classified as useful. Excluded samples remain stored with classification, quality score, and metadata so upload summaries are auditable.

## Upload and Parsing

The upload route accepts:

- Twitter/X archive ZIP
- `.js`
- `.json`
- `.csv`
- `.txt`

Parsing rules:

- ZIP: inspect contained files and parse likely Twitter archive tweet files such as `tweets.js`, `tweets-part*.js`, and files containing `window.YTD.tweets.part0 = ...`.
- JS: strip known assignment prefixes and parse the remaining JSON.
- JSON: accept arrays, Twitter archive objects, and simple tweet-like objects.
- CSV: map common columns such as `text`, `tweet`, `created_at`, `favorite_count`, and `retweet_count`.
- TXT: split samples by blank lines, falling back to line-based samples.

The parser should extract, when available:

- tweet text
- created date
- favorite count
- retweet count
- reply metadata
- hashtags
- mentions
- URLs
- language

The upload route imports at most 5,000 samples per upload. If the parser can detect more items, the summary should report total found separately from imported count.

## Cleaning and Classification

The cleaning module stores raw and cleaned text for every imported sample.

Classifications:

- `original`
- `reply`
- `quote`
- `thread_candidate`
- `link_only`
- `retweet`
- `too_short`
- `noisy`
- `useful`

Default exclusions from voice learning:

- retweets
- link-only tweets
- tweets under 20 characters
- tweets that are only mentions
- tweets that are only hashtags
- obvious giveaway posts
- automated posts
- duplicate tweets
- pure URL posts

Useful tweets are assigned higher quality scores. Classification counts drive the upload summary, for example: "Found 4,280 tweets. Imported 4,280. 1,740 are useful for voice learning. 620 are retweets. 310 are link-only. 490 are too short/noisy."

## Voice Report

Voice analysis uses the top 200 useful samples by quality score. If fewer are available, it uses all useful samples.

The report shape is:

```ts
type VoiceReport = {
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
```

With a configured LLM, `analyzeVoice.ts` asks the provider for structured JSON. Without a key, it builds a mock but plausible report from local heuristics: average length, punctuation, emoji usage, first/second person usage, recurring terms, line breaks, hooks, and endings.

## Voice Skill File

The skill file is the main product artifact. It is created from the brand fields and the voice report.

The required shape is:

```ts
type VoiceSkillFile = {
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
```

The skill file has four conceptual layers:

1. Core Voice Identity: traits, this-not-that rules, beliefs, and audience.
2. Linguistic Mechanics: sentence length, tweet length, punctuation, emojis, hooks, endings, and formatting.
3. Contextual Tone: rules for launches, founder opinions, education, contrarian takes, product updates, community posts, soft CTAs, and threads.
4. Example Library: on-brand examples, off-brand examples, approved generated examples, rejected generated examples, banned phrases, and preferred phrases.

The skill file page uses JSON editing as the primary surface. Saving validates parseability and required top-level shape, then creates a new version.

## Tweet Studio

Tweet Studio inputs:

- raw idea or context
- tweet type
- number of variations
- optional notes

Tweet types:

- single tweet
- thread
- founder opinion
- product update
- educational post
- contrarian take
- launch announcement
- soft CTA

Generation uses:

- brand context
- latest Voice Skill File
- representative useful tweets
- approved generated examples
- banned phrases
- anti-generic rules
- optional user notes

Banned phrases include:

- game-changing
- revolutionary
- unlock the future
- seamless
- in today's fast-paced world
- let's dive in
- supercharge
- cutting-edge
- we are excited to announce
- powerful solution
- transform the way

Generated tweets should be concise, specific, Twitter-native, free of unnecessary hashtags, and should not invent metrics or claims.

Each generated result includes:

- tweet text
- voice match score
- score label
- short reason
- detected issues
- suggested revision direction

## Evaluation

`evaluateTweet.ts` scores every generated tweet out of 100:

- brand voice match: 35
- Twitter nativeness: 20
- specificity: 15
- hook quality: 10
- non-generic quality: 10
- CTA/context fit: 5
- safety/factuality: 5

Labels:

- 90-100: Very strong match
- 80-89: Strong match
- 70-79: Good match
- below 70: Weak match

For Phase 1, evaluation is heuristic even when generation uses a real LLM. This keeps scoring stable, transparent, and testable. The reserved evaluator prompt file allows later LLM-backed evaluation without changing routes or UI contracts.

## Feedback Loop

Every generated tweet supports feedback:

- Sounds like us
- Too generic
- Too formal
- Too casual
- Too salesy
- Too polished
- Too long
- Too much hype
- Wrong vocabulary
- Good idea, wrong tone
- Good tone, weak hook

Users may add an optional comment.

Feedback creates a `Feedback` record and a new `SkillFile` version. Updates are deterministic in Phase 1:

- `Sounds like us`: add the generated tweet to `exampleLibrary.approvedGenerated`.
- `Too generic`: add a rule to prefer specific examples, concrete nouns, and sharper claims.
- `Too polished`: add a rule to avoid polished corporate announcement language and add phrases such as "we are excited to announce", "seamless", and "game-changing" to avoided phrases.
- `Too formal`: add a rule to use plainer, more conversational language.
- `Too casual`: add a rule to preserve clarity and credibility.
- `Too salesy`: add a rule to reduce promotional framing and use more evidence or context.
- `Too long`: add a concision rule.
- `Too much hype`: add hype words to avoided phrases.
- `Wrong vocabulary`: if the comment includes specific wording, add it to avoided phrases.
- `Good idea, wrong tone`: add the tweet to rejected generated examples and add a tone correction rule.
- `Good tone, weak hook`: add a hook-strengthening rule.

## API Routes

Brands:

- `POST /api/brands`
- `GET /api/brands`
- `GET /api/brands/[brandId]`
- `PATCH /api/brands/[brandId]`

Uploads:

- `POST /api/brands/[brandId]/uploads`

Voice report:

- `POST /api/brands/[brandId]/analyze`

Skill file:

- `GET /api/brands/[brandId]/skill-file`
- `PATCH /api/brands/[brandId]/skill-file`

Tweet generation:

- `POST /api/brands/[brandId]/generate`

Feedback:

- `POST /api/generations/[generationId]/feedback`

Settings:

- No API keys are persisted server-side.
- No settings API route is required in Phase 1. The settings page stores provider, model, base URL, and API key in browser `localStorage`; `.env.local` remains the server-side fallback for local development.

## Error Handling

Upload errors should be specific and user-actionable. Failed uploads create or update an upload record with `status = "failed"` when possible.

If no useful samples remain after cleaning, the upload page shows exclusion counts and asks for more representative samples.

If analysis is requested before upload, the brand page points the user to upload content first.

If skill file JSON is invalid, the app rejects the save without creating a new version.

If generation is requested without a skill file, the app should prompt the user to analyze first. Mock generation may still produce a basic output, but the UI should make clear that a skill file improves results.

If a real LLM call fails, show the provider error. Do not hide it behind a mock fallback unless no provider key was supplied.

## Testing

Add focused tests for:

- parsing `tweets.js`
- stripping `window.YTD... =` assignment prefixes
- parsing simple JSON, CSV, and TXT samples
- cleaning tweet text
- classifying retweets
- classifying link-only posts
- classifying too-short/noisy posts
- duplicate exclusion
- creating a skill file from a voice report
- updating a skill file from feedback
- evaluator scoring labels

Use small fixtures and avoid network calls. LLM-dependent paths should use mock providers in tests.

## Acceptance Criteria

The MVP is complete when:

- A user can create a brand.
- A user can upload a Twitter archive file or tweet sample file.
- The system parses and stores tweets.
- The system filters noisy tweets.
- The upload page shows an ingestion summary.
- A user can generate a voice report.
- A user can create a Voice Skill File.
- A user can view and edit the skill file JSON.
- A user can enter an idea and generate tweet variations.
- Each generated tweet has a voice match score and score label.
- A user can give feedback on generated tweets.
- Feedback updates the skill file and creates a new version.
- The app works without any LLM API key using mock responses.
- Provider keys can be supplied through `.env.local` or browser-local BYOK settings.
- API keys are not persisted in SQLite.
- No scheduling, posting, analytics, competitor research, OAuth, billing, or multi-platform support is implemented.
