# Voice Imitation Research and UX Audit

Date: 2026-04-26

## Executive Summary

The product is directionally right: it treats the Voice Skill File as the core asset, preserves examples, generates a larger candidate pool, evaluates drafts, and learns from feedback. The main issue is that the strongest research-backed pieces are not yet fully connected to the product loop.

Most importantly, the current analysis pipeline computes a deterministic corpus profile but does not pass it into the Skill File creation path. In the current Metrom 2 workspace, the latest Skill File has no `corpusProfile` and reports `corpusSampleCount: 8`, despite the dashboard showing 582 useful samples. That means generation is much closer to "prompt plus a few examples" than "voice model over the corpus."

The next upgrade should focus on four things:

1. Make corpus-level style evidence first-class in the Skill File.
2. Use retrieved examples as a compact, task-specific exemplar packet, not just a blob inside a large prompt.
3. Score style separately from content, fluency, and factuality.
4. Make the UX reveal what the system learned, what evidence it used, and why a draft is or is not voice-faithful.

## Research Findings

### 1. Examples help, but they do not fully solve style imitation

Recent style-imitation evaluations show that prompting strategy matters a lot. In "How Well Do LLMs Imitate Human Writing Style?", few-shot prompting substantially outperformed zero-shot prompting, and completion-style prompting performed best in the authors' setup. But the same paper also found that stylistically matched LLM outputs can remain statistically more predictable than human writing, meaning "style match" and "human-like variation" are separate problems.

Source: [How Well Do LLMs Imitate Human Writing Style?](https://arxiv.org/abs/2509.24930)

Implication for us: examples should be close to generation, but we should not assume more raw examples in the prompt equals better voice. We need exemplar selection, style metrics, and reranking.

### 2. Everyday personal voice is subtle and implicit

"Catch Me If You Can? Not Yet" evaluates more than 40,000 generations across 400+ authors and finds that LLMs can approximate style better in structured domains such as news and email, but struggle more with informal, nuanced writing such as blogs and forums. The paper also notes that sliders for tone, formality, and voice are too coarse for personal style.

Source: [Catch Me If You Can? Not Yet: LLMs Still Struggle to Imitate the Implicit Writing Styles of Everyday Authors](https://aclanthology.org/2025.findings-emnlp.532.pdf)

Implication for us: Twitter voice is closer to informal, high-context writing than clean corporate writing. The product must capture quirks, rhythm, starts, endings, formatting, topic habits, and what the brand refuses to sound like.

### 3. LLMs have their own default writing style

PNAS research comparing human and LLM writing across genres found systematic lexical, grammatical, and rhetorical differences. Instruction-tuned models in particular retained a distinct style even when prompted to match informal human text.

Source: [Do LLMs write like humans? Variation in grammatical and rhetorical styles](https://arxiv.org/abs/2410.16107)

Implication for us: the generator is always fighting a model default. We should explicitly penalize model-native patterns, not just banned phrases. This includes over-polished structure, generic contrast patterns, inflated nouns, symmetric phrasing, and too-clean conclusions.

### 4. Style transfer must balance style strength, content preservation, and fluency

Text style transfer research commonly evaluates three axes: target style strength, semantic preservation, and fluency. A draft can be fluent and relevant while still failing voice, or voicey but off-brief.

Source: [Deep Learning for Text Style Transfer: A Survey](https://aclanthology.org/2022.cl-1.6/)

Implication for us: our score should not collapse everything into one "good match" number. Users need to see voice match, brief fit, factuality, and Twitter nativeness separately.

### 5. Control is a broader problem than prompt wording

The controllable text generation survey frames style control as one of several control conditions and reviews prompt engineering, fine-tuning, reinforcement learning, latent-space methods, and decoding-time interventions. It also highlights real-world challenges such as fluency and practicality.

Source: [Controllable Text Generation for Large Language Models: A Survey](https://arxiv.org/abs/2408.12599)

Implication for us: a practical product can start with prompting, retrieval, evaluation, and feedback loops, but should be designed so we can later add fine-tuning or classifier-based reranking if needed.

### 6. Persona and behavior can drift

Anthropic's persona-vectors research shows that model "character traits" can shift during deployment or training and can be monitored through internal activations in open models. A separate 2026 paper describes a default "Assistant Axis," where language models tend to return to a helpful assistant persona after post-training.

Sources:
- [Anthropic: Persona vectors](https://www.anthropic.com/research/persona-vectors?cam=claude)
- [The Assistant Axis](https://arxiv.org/abs/2601.10387)

Implication for us: even when the model has a Voice Skill File, it can slide back toward helpful assistant or polished marketer. We need repeated local grounding: examples, constraints, evaluation, and retry loops.

## Current System Assessment

### What is already strong

- The architecture has the right product loop: upload, parse, analyze, Skill File, generate, evaluate, feedback, revise.
- `lib/voice/corpusProfile.ts` computes useful corpus-level mechanics: length distribution, line-break rate, emojis, punctuation, capitalization, pronouns, vocabulary, hooks, endings, and representative examples.
- `lib/voice/selectExamples.ts` retrieves examples before generation.
- `lib/voice/generateTweets.ts` generates a larger internal candidate pool and reranks before display.
- `lib/voice/evaluateTweet.ts` combines heuristic checks with optional LLM evaluation.
- `lib/voice/updateSkillFileFromFeedback.ts` creates new immutable Skill File versions from feedback.
- The UI exposes next actions after upload, analysis, skill review, generation, and feedback.

### Main implementation gaps

1. Corpus profile is computed but not persisted into the initial Skill File.

`analyzeVoice()` builds `corpusProfile`, but returns only `VoiceReport`. The route then calls:

```ts
createVoiceSkillFile({ version: "v1.0", brand, report })
```

without passing a corpus profile. This leaves `corpusProfile`, `preferredTopics`, richer vocabulary, and actual corpus sample count out of the Skill File.

Relevant files:
- `lib/voice/analyzeVoice.ts`
- `app/api/brands/[brandId]/analyze/route.ts`
- `lib/voice/createSkillFile.ts`

2. Re-analysis does not refresh the Skill File when one already exists.

If a Skill File exists, the analyze route stores a new Voice Report and returns the existing Skill File. The UI button says "Re-analyze voice," but generation still uses the old Skill File. That creates a trust gap: the user thinks the voice improved, but the studio may still generate from stale instructions.

3. Rule evidence exists in the type but not in the prompt or UI.

`VoiceReport` supports optional `ruleEvidence`, but the analysis prompt does not request it, `normalizeVoiceReport()` does not preserve it, and `VoiceReportView` does not show evidence. This misses the best UX opportunity: showing why a rule exists.

4. Generation prompt over-includes the Skill File.

`generateTweetPrompt()` includes examples, counterexamples, and then the full JSON Skill File. This can bury the actual task-specific evidence in a large prompt. It also risks overfitting to global voice summaries instead of the closest real examples.

5. Retrieval is lexical and global.

Current retrieval uses term overlap, tweet-type term overlap, preferred vocabulary, preferred topics, quality score, and approved-example boost. This is a good start, but it does not yet compare structure, opening move, line-break template, format class, or semantic topic embeddings.

6. Evaluation does not yet measure style distance.

The heuristic evaluator catches obvious slop, length, hashtags, numeric claims, and context overlap. But it does not compare a draft against real corpus statistics or nearest examples. Brand voice scoring starts from a high default, so the system can be generous unless hard issues trigger.

7. Provider mode is client-local.

The settings and studio mode label are based on localStorage only. The UI says a user can leave browser settings empty and use `.env.local`, but the client cannot know whether the server has a usable provider key. This can make the mode banner misleading.

## UX Audit

### End-to-end flow

Current flow:

1. Home: create or pick workspace.
2. Brand dashboard: shows counts and current stage.
3. Upload: parse files and preview useful samples.
4. Voice Report: analyze voice and view summary.
5. Skill File: review/edit JSON.
6. Tweet Studio: generate, score, collect feedback, revise.

This is the right skeleton. The friction is that the system asks the user to trust invisible intelligence. The user sees "582 useful samples," "Voice report created," and "Skill file v1.6," but not:

- what corpus mechanics were actually learned
- whether the Skill File is stale relative to the latest upload/report
- which examples were used for a generation
- why a generated tweet scored as voice-faithful
- what changed after feedback beyond a short rule list

### High-impact UX improvements

1. Add a persistent "Voice Health" panel.

Show:

- useful samples
- last upload date
- last analysis date
- latest Skill File version
- corpus profile present or missing
- provider mode
- approved/rejected generated examples
- confidence warning if sample count is low or Skill File is stale

2. Make analysis evidence-first.

Instead of only sliders and lists, show:

- "Rules we learned"
- evidence quotes under each rule
- mechanics cards: length range, line-break rate, emoji/hashtag rate, common openings, common endings
- "This, not that" contrasts

3. Turn Skill File view into an inspector, not a JSON editor first.

Keep JSON editing, but move it behind an "Advanced JSON" section. First show:

- strongest rules with confidence
- evidence examples
- preferred structures
- banned phrases
- retrieval hints
- version history and diff

4. Show generation provenance.

Each generated card should expose:

- Skill File version used
- provider mode
- nearest examples used
- style score breakdown
- brief-fit score
- factuality warnings
- "retry using stricter voice" action

5. Improve feedback ergonomics.

The current feedback UI is promising. It should add:

- phrase-level rejection: "this phrase is wrong"
- one-click labels for "wrong structure," "wrong opener," "too generic," "too polished," "wrong vocabulary"
- preview of the exact Skill File patch before applying
- ability to approve with comment, not just approve silently

## Recommended Next Implementation Pass

### Phase 1: Fix the voice-data plumbing

- Change `analyzeVoice()` to return `{ report, corpusProfile, corpusStats, selectedSamples }`.
- Pass `corpusProfile` into `createVoiceSkillFile()`.
- When re-analyzing, create a new Skill File version instead of returning the existing one.
- Add tests proving `SkillFile.corpusProfile` and `modelNotes.corpusSampleCount` reflect the useful corpus.
- Add stale-state detection: latest upload/report newer than latest Skill File.

### Phase 2: Better style representation

- Add a compact "voice kernel" generated from corpus profile:
  - length bands
  - line-break templates
  - emoji/hashtag/mention/url rates
  - pronoun rates
  - opening patterns
  - ending patterns
  - punctuation habits
  - forbidden model-default patterns
- Preserve evidence quotes per rule.
- Expand `ruleEvidence` support through prompt, normalization, storage, and UI.

### Phase 3: Retrieval and prompt redesign

- Retrieve by topic plus structure:
  - semantic topic match
  - tweet type
  - line-break template
  - opener class
  - length band
  - vocabulary overlap
  - feedback approval/rejection
- Send a compact packet to generation:
  - task brief
  - hard factual constraints
  - voice kernel
  - 5 to 8 nearest positive examples
  - 2 to 4 negative examples
  - exact output contract
- Avoid dumping the entire Skill File unless the selected model/context needs it.

### Phase 4: Style-aware evaluation and retry

- Add a local style-distance scorer:
  - char n-gram similarity
  - punctuation profile distance
  - line-break/template match
  - length percentile
  - pronoun/hashtag/emoji rates
  - banned phrase/model-slop penalty
- Keep LLM evaluation, but make it compare against selected examples and corpus metrics.
- Add automatic retry when all candidates fail the voice threshold.
- Store evaluation metadata so the UI can explain scores.

### Phase 5: UX polish around trust

- Voice Health panel on dashboard and studio.
- Evidence-backed Voice Report.
- Skill File inspector plus version diff.
- Generation provenance drawer.
- Feedback patch preview and review.

## Immediate Priority

Do this first:

1. Pass corpus profile into Skill File creation.
2. Regenerate a new Skill File version on re-analysis.
3. Show in the UI whether the active Skill File has a corpus profile and how many samples it represents.
4. Add selected examples and score breakdown to generated cards.

These four changes directly address the biggest failure mode from the research: the model drifting back to generic assistant/marketer style because the real writing evidence is not kept close enough to generation and evaluation.

## Verification Performed

- `npm test`: 24 files, 68 tests passed.
- `npm run build`: production build completed successfully.
- In-app browser inspection covered home, brand dashboard, settings, and Tweet Studio.

## Implementation Status, 2026-04-27

Phases 1 through 6 have been implemented in code: corpus-backed Skill File regeneration, voice kernel extraction, evidence-backed rules, compact voice packets, structure-aware retrieval, style-distance scoring, retry metadata, trust-oriented UI, Skill File version diff, generation provenance, feedback patch preview, and hybrid semantic retrieval.

Phase 6 adds persisted local sample embeddings. Generation and revision now lazily backfill missing sample embeddings when an OpenAI or OpenAI-compatible embedding provider is available, embed the current brief, retrieve by semantic similarity, and then rerank with the existing voice/kernel scorer. If embeddings are unavailable or fail, generation falls back to the lexical plus structural retrieval path.

Other known gaps:

- Existing brands with old Skill Files need re-analysis to produce corpus-backed Skill Files.
- Provider availability still depends mostly on client/settings flow rather than a server-aware status surface.
- Live quality has not been validated against a real provider call for every brand; automated tests cover the pipeline with mocked providers.
