# Voice Skill File for Twitter/X

A voice intelligence studio for turning a brand's real Twitter/X archive into a reusable Skill File, then using that Skill File to generate, score, revise, and improve new tweets.

This project is built around a simple belief: brand voice is not a prompt. It is a system of examples, constraints, habits, retrieval, evaluation, and feedback.

## Why This Exists

LLMs can imitate obvious surface style: a few words, a tone label, maybe a familiar cadence. That is usually not enough.

In practice, "write like this account" fails because the model loses the mechanics that make a voice feel native:

- which examples are actually useful for voice, and which are replies, quotes, timeline artifacts, or noisy archive rows
- which topics, nouns, claims, and openings recur in the corpus
- how long the account tends to write, how it punctuates, and how often it uses questions, CTAs, emojis, line breaks, or launch language
- which examples are semantically relevant to the current draft request
- which generated drafts should be rejected even if they sound fluent
- how user feedback should change the draft now and teach the system for future drafts

This app treats voice imitation as an evidence pipeline, not as a one-shot prompt.

## What It Does

Voice Skill File for Twitter/X helps a user:

1. Create a brand profile.
2. Upload Twitter/X archive data.
3. Parse and clean tweets into useful voice samples.
4. Analyze the corpus into a structured Voice Report.
5. Generate a versioned Skill File from the analysis.
6. Draft tweets in Tweet Studio using the latest Skill File.
7. Retrieve relevant corpus examples for the topic.
8. Score and rerank drafts by brand fit, Twitter nativeness, specificity, and local style distance.
9. Revise a draft with a plain-language note.
10. Save feedback so future generations learn what to prefer or avoid.

The goal is not to make generic "on-brand" copy. The goal is to preserve the brand's actual writing behavior and make every draft explainable against the corpus.

## How The Engine Works

### Archive Parsing And Cleaning

The ingestion layer separates useful writing samples from archive noise. It strips timeline labels, quote/media/link-card artifacts, and reply framing that should not become brand voice. Reply tweets can still exist as samples, but they should not be mistaken for opening hooks.

### Corpus Profile

The corpus profile summarizes repeated patterns across useful samples:

- common hooks and endings
- preferred terms and recurring phrases
- length bands and formatting habits
- punctuation, emoji, hashtag, mention, and line-break rates
- high-quality examples for the Skill File

### Stylometric Voice Kernel

The voice kernel adds lower-level mechanics that a plain prompt usually misses:

- average word count
- punctuation density
- question and exclamation rates
- top character trigrams
- formatting and vocabulary constraints

This gives the evaluator a local style-distance signal, not just an LLM opinion.

### Hybrid Retrieval

Tweet Studio uses hybrid retrieval:

1. Embeddings find examples that are semantically close to the user's request.
2. Voice/kernel scoring reranks those examples for brand fit.
3. The generator receives relevant on-brand examples and counterexamples.

This makes the selected evidence topic-aware without letting semantic similarity override voice.

### Generation, Evaluation, And Reranking

The app generates more candidates than it displays, evaluates them, removes weak drafts when possible, and shows the strongest outputs. Evaluation combines provider judgment with local checks for:

- brand voice match
- Twitter/X nativeness
- specificity
- hook quality
- generic or model-default phrasing
- factual safety
- style distance from the corpus

### Revision Notes And Feedback

Tweet Studio separates two workflows that often get confused:

- **Revise with note:** apply a note to the current draft and create a replacement.
- **Skill File patch:** teach future drafts by saving feedback into the voice system.

That means a user can say "mention LPs directly and remove the hype" and get a revised draft immediately, without having to understand the internal feedback machinery.

### Persistence

The app uses Prisma with Neon Postgres. The database stores brands, uploads, cleaned content samples, voice reports, versioned Skill Files, generations, feedback, and cached embeddings.

## Product Flow

```text
Upload archive
  -> parse and clean samples
  -> analyze voice
  -> create Skill File
  -> generate tweets in Tweet Studio
  -> retrieve semantic examples
  -> rerank by voice kernel
  -> evaluate and score drafts
  -> revise with notes
  -> save feedback into the Skill File
```

## Stack

- **App:** Next.js App Router, React
- **Database:** Prisma, Neon Postgres
- **LLM provider:** OpenAI by default, with support for Anthropic, OpenRouter, and OpenAI-compatible providers
- **Embeddings:** OpenAI or compatible embedding providers
- **Testing:** Vitest
- **UI:** Tailwind CSS, lucide-react

## Run Locally

Install dependencies:

```bash
npm install
```

Create your local environment file:

```bash
cp .env.example .env
```

Fill in the database values:

```bash
DATABASE_URL="postgresql://USER:PASSWORD@HOST-pooler.REGION.aws.neon.tech/DB?sslmode=require"
DIRECT_URL="postgresql://USER:PASSWORD@HOST.REGION.aws.neon.tech/DB?sslmode=require"
```

Use the pooled Neon URL for `DATABASE_URL` and the direct Neon URL for `DIRECT_URL`. Prisma uses the direct URL for migrations.

Add at least one real provider key:

```bash
OPENAI_API_KEY="..."
```

Generate the Prisma client and apply migrations:

```bash
npx prisma generate
npx prisma migrate deploy
```

Start the development server:

```bash
npm run dev
```

Open:

```text
http://127.0.0.1:3000
```

## Verification

Useful checks:

```bash
npm test
npm run lint -- --max-warnings=0
npm run build
npx prisma validate
npx prisma migrate status
```

The current system has also been smoke-tested with real OpenAI calls for voice analysis, tweet generation, and note-based revision.

## Environment And Secrets

The repo intentionally ignores local runtime state:

- `.env`
- `.env.local`
- `prisma/dev.db`
- `.next`
- `node_modules`
- `.DS_Store`

Only placeholder values belong in committed docs or examples. Real Neon URLs, API keys, and provider secrets should stay local or live in the deployment platform's secret manager.

## Roadmap

Near-term hardening:

- provider-specific structured outputs for stricter JSON guarantees
- recurring real-provider evaluation suites
- richer voice benchmarks across brands and content types
- deployment hardening for production hosting
- clearer observability around retrieval, scoring, and revision outcomes

## Repository

Private GitHub repository:

```text
https://github.com/afk1997/voice-skill-file-twitter-x
```

