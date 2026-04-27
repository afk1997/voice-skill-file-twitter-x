# Production Voice Quality Research Refresh

Date: 2026-04-27

## What The Research Says

High-fidelity voice generation is not solved by adding more examples to a prompt. Recent style-imitation work points to a hybrid system: compact task-relevant examples, corpus-level mechanics, stylometric distance, semantic retrieval, evaluator feedback, and a human revision loop.

Key findings:

- Style imitation papers use character n-grams plus transformer embeddings for authorship/style verification. This supports our hybrid approach: semantic retrieval for topic, then voice/kernel/stylometry reranking for style. Source: https://arxiv.org/abs/2509.24930
- LLM outputs remain detectably different from human writing across grammatical and rhetorical features, especially for instruction-tuned models. We need explicit penalties for model-default copy, not just generic prompts. Source: https://arxiv.org/abs/2410.16107
- Everyday author style is implicit and hard to express with tone sliders. The system must capture openings, endings, formatting, punctuation, vocabulary, and negative examples. Source: https://aclanthology.org/2025.findings-emnlp.532.pdf
- Text style transfer quality is multi-axis: style strength, content preservation, and fluency. Our evaluator should keep voice, brief fit, factuality, and Twitter nativeness separate. Source: https://direct.mit.edu/coli/article/48/1/155/108845/Deep-Learning-for-Text-Style-Transfer-A-Survey
- RAG evaluation frameworks evaluate context relevance, answer faithfulness, and answer relevance. For voice, the analogous checks are selected-example relevance, no unsupported claims, and voice faithfulness. Sources: https://arxiv.org/abs/2309.15217 and https://aclanthology.org/2024.naacl-long.20/
- Iterative refinement improves generation at test time. The studio should make "note -> revised draft" first-class, while keeping "teach the Skill File" separate. Source: https://arxiv.org/abs/2303.17651
- OpenAI embeddings are appropriate for semantic retrieval, and Structured Outputs are still the next production hardening step for schema adherence. Sources: https://platform.openai.com/docs/guides/embeddings/embedding-models%20.class and https://platform.openai.com/docs/guides/structured-outputs/supported-schemas

## What We Implemented From This Pass

- Added corpus stylometry to the Skill File kernel:
  - top character trigrams
  - punctuation density
  - average word count
  - question/exclamation rates
- Added `stylometryFit` to style-distance scoring.
- Made analysis sample selection diversity-aware so repeated near-duplicates do not fill the voice-analysis packet.
- Preserved classification in re-analysis so reply samples do not become opening hooks.
- Marked older corpus-backed Skill Files as refresh-needed when they lack the new stylometric kernel.
- Fixed provider trust UX so server `.env` provider status appears as real quality mode without exposing the key.
- Made tweet revision note-first:
  - "Revise with note" changes the current draft immediately.
  - "Preview Skill File patch" and "Teach voice & revise" remain explicit learning actions.
- Cleaned nearest-example explanations so non-launch/non-thread drafts are not explained with live/launch/thread evidence.

## Remaining Production Hardening

The next most valuable production step is strict schema validation for model outputs. We currently use JSON mode plus parsing/repair. Official OpenAI guidance recommends Structured Outputs when possible because JSON mode does not guarantee schema adherence. This should be implemented provider-by-provider so OpenRouter/local OpenAI-compatible paths do not regress.

The second step is an offline eval set: fixed prompts, expected constraints, generated outputs, selected evidence, and pass/fail checks. The app now has the pieces; production readiness needs a repeatable eval command that runs real provider calls on a small canonical suite.
