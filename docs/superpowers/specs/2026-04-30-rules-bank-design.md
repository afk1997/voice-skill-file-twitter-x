# Rules Bank And Skill File Hardening Design

Date: 2026-04-30
Status: approved design, pending implementation plan

## Purpose

Build a first-class rules bank where users can select starter rules, create reusable custom rules, preview the exact Skill File changes, and apply those rules as one versioned Skill File hardening batch.

The rules bank should make the pasted writing ruleset usable as practical starter rules. It should not replace the existing Skill File. The Skill File remains the canonical artifact used by generation, evaluation, retrieval, and feedback learning.

## Goals

- Add curated starter rules derived from the writing ruleset.
- Let users create custom reusable rules.
- Support global rules and brand-scoped custom rules.
- Let each brand maintain selected rules without changing the Skill File immediately.
- Preview the exact Skill File patch before applying.
- Apply selected rules as a single new Skill File version.
- Preserve a history of previewed and applied rule batches.
- Use mixed enforcement modes: guidance, hard constraint, banned phrase, and retrieval hint.

## Non-Goals

- Do not replace the voice analysis pipeline.
- Do not make starter rules editable through the UI.
- Do not create a new Skill File version on every checkbox toggle.
- Do not build collaborative permissions, sharing, or multi-user ownership in this version.
- Do not backfill existing Skill Files. They remain valid as-is.

## Current Context

The app already stores versioned Skill Files in `SkillFile.skillJson`. The `VoiceSkillFile` type includes fields that can absorb rules cleanly:

- `rules?: SkillRule[]`
- `linguisticRules: string[]`
- `avoidedPhrases: string[]`
- `retrievalHints?: { preferredTopics; preferredStructures; preferredVocabulary; avoidVocabulary }`

Generation already reads high-confidence rule data through `voicePacketFromSkillFile` and includes hard constraints from `rules`, `linguisticRules`, and `avoidedPhrases`. Evaluation already detects avoided phrases, learned em dash bans, model-default phrasing, and some hard safety issues. The rules bank should compose into these existing fields first, then add targeted evaluator logic only where a rule can be detected reliably.

## Architecture

Add a real rules-bank layer beside the existing Skill File system:

```text
RuleBankRule
  -> BrandRuleSelection
  -> compileRulesToSkillPatch
  -> RuleApplication preview
  -> Apply
  -> new SkillFile version
  -> generation/evaluation use latest SkillFile
```

The rules bank owns reusable definitions and selections. The Skill File owns generation-ready instructions. Applying rules copies the selected rule effects into the latest Skill File JSON and creates one new Skill File row.

## Data Model

Keep the existing `SkillFile` model unchanged.

Add Prisma enums:

- `RuleSource`: `starter`, `custom`
- `RuleScope`: `global`, `brand`
- `RuleMode`: `guidance`, `hard_constraint`, `banned_phrase`, `retrieval_hint`
- `RuleCategory`: `format_fit`, `specificity`, `fact_discipline`, `regularity`, `plain_language`, `formula_phrases`, `accessibility`, `stance_voice`, `provenance`
- `RuleTarget`: `skill_rules`, `linguistic_rules`, `avoided_phrases`, `retrieval_preferred_topics`, `retrieval_preferred_structures`, `retrieval_preferred_vocabulary`, `retrieval_avoid_vocabulary`
- `RuleApplicationStatus`: `previewed`, `applied`, `discarded`

Add `RuleBankRule`:

- `id`
- `title`
- `body`
- `category`
- `mode`
- `source`
- `scope`
- `brandId`, nullable for global rules
- `targetJson`, a JSON array of `RuleTarget` values
- `payloadJson`, structured details such as phrases, confidence, appliesTo, supporting examples, counterexamples, and retrieval terms
- `enabled`
- `createdAt`
- `updatedAt`

Add `BrandRuleSelection`:

- `id`
- `brandId`
- `ruleId`
- `selected`
- `overrideJson`, optional brand-specific wording or severity adjustment
- `createdAt`
- `updatedAt`
- unique index on `brandId` and `ruleId`

Add `RuleApplication`:

- `id`
- `brandId`
- `status`
- `selectedRuleIdsJson`
- `previewPatchJson`
- `baseSkillFileId`
- `baseSkillFileVersion`
- `resultSkillFileId`, nullable until applied
- `createdAt`
- `appliedAt`, nullable until applied

The preview stores the base Skill File id/version so stale previews can be rejected if a newer Skill File appears before apply.

## Starter Rules

Starter rules are seeded from a typed module derived from the pasted writing ruleset. They are stored as `RuleBankRule` rows with `source: starter`, `scope: global`, and stable ids or slugs so reseeding is idempotent.

Starter categories:

- `format_fit`: match structure and punctuation to the medium.
- `specificity`: prefer concrete anchors over polished generality.
- `fact_discipline`: avoid invented metrics, dates, quotes, hidden mechanisms, and unsupported causality.
- `regularity`: catch repeated sentence moves, list cadence, and too-neat paragraph arcs.
- `plain_language`: prefer verbs, ordinary words, and useful repetition.
- `formula_phrases`: ban or scrutinize common formula phrases and generic jargon.
- `accessibility`: preserve useful headings, lists, descriptive links, and citations when the medium requires them.
- `stance_voice`: calibrate confidence, neutrality, and visible writer stance to the genre.
- `provenance`: use draft history, sources, and citations for high-stakes authorship claims.

Examples of seeded rules:

- Do not invent metrics, customers, dates, quotes, roadmap timing, or factual claims.
- Each substantial paragraph should carry at least one concrete anchor.
- Avoid formula phrases such as "ever-evolving landscape", "it's important to note", and "in conclusion" unless the context truly calls for them.
- In casual internet prose, prefer commas, colons, or full stops over repeated em dashes.
- Do not add fake-human typos, slang, staged uncertainty, or random fragments.
- Preserve accessibility and scannability for docs, web pages, UI text, and public help content.
- Use provenance rather than surface style when authorship matters.

## Rule Compilation

Create a pure compiler, `compileRulesToSkillPatch`, in `lib/rules/compileRulesToSkillPatch.ts`.

Input:

- latest `VoiceSkillFile`
- selected `RuleBankRule[]`
- matching `BrandRuleSelection[]`
- optional next version

Output:

- `nextSkillFile`: the complete Skill File JSON if applied
- `patch`: structured additions by target
- `items`: human-readable preview lines for the UI
- `selectedRuleIds`
- `baseVersion`

Compilation behavior:

- `guidance` rules create structured `SkillRule` entries. They may also add a concise `linguisticRules` line when their target includes `linguistic_rules`.
- `hard_constraint` rules create high-confidence `SkillRule` entries and add `linguisticRules` lines so generation treats them as hard constraints.
- `banned_phrase` rules add phrases to `avoidedPhrases`, `retrievalHints.avoidVocabulary`, and a `SkillRule` explaining the ban.
- `retrieval_hint` rules update the relevant retrieval hint arrays.
- Duplicate phrases and rules are normalized case-insensitively.
- Re-applying the same selected rules is idempotent.
- Applying creates exactly one new `SkillFile` row for the batch.

`SkillRule` entries created by the compiler should use stable ids such as `bank-<ruleId>` and confidence values from `payloadJson`, falling back to:

- guidance: 76
- hard constraint: 92
- banned phrase: 90
- retrieval hint: 78

## UI

Add `/rules` for global rule management:

- Browse starter and custom global rules.
- Filter by category, mode, source, and enabled state.
- Create and edit custom global rules.
- Starter rules are read-only.
- No brand Skill File application happens on this page.

Add `/brands/[brandId]/rules` as the main working page:

- Link from the brand dashboard and Skill File page.
- Show all applicable rules: global starter, global custom, and brand-scoped custom rules.
- Support filters for category, mode, source, and selected-only.
- Rule rows show checkbox, title, short body, mode badge, category badge, and source badge.
- Custom brand rules can be created from the page.
- Toggling checkboxes saves `BrandRuleSelection` only.
- Preview panel shows:
  - selected rule count
  - additions to `rules`
  - additions to `linguisticRules`
  - additions to `avoidedPhrases`
  - retrieval hint changes
  - next Skill File version
  - stale preview warning when relevant
- `Apply to Skill File` creates one new version and records the application.
- Success state links to the Skill File and Studio.

The existing Skill File page should add an "Open Rules Bank" action and show recent applied rule batches when available.

## API

Add server endpoints:

- `GET /api/rules`: list global starter/custom rules with filters.
- `POST /api/rules`: create a custom global rule.
- `PATCH /api/rules/[ruleId]`: edit custom rules only.
- `GET /api/brands/[brandId]/rules`: list applicable rules, selections, latest Skill File summary, and recent applications.
- `POST /api/brands/[brandId]/rules`: create a brand-scoped custom rule.
- `PATCH /api/brands/[brandId]/rules/[ruleId]`: edit brand-scoped custom rules for that brand only.
- `PATCH /api/brands/[brandId]/rules/selections`: save selected/unselected state in bulk.
- `POST /api/brands/[brandId]/rules/preview`: compile selected rules against the latest Skill File and store a `RuleApplication` with `status: previewed`.
- `POST /api/brands/[brandId]/rules/apply`: apply a stored preview or the current selected set, create one new Skill File version, and mark the application `applied`.

Validation:

- Custom rule title and body are required.
- `mode`, `category`, and `targetJson` values must be known.
- Banned phrase rules require at least one phrase in `payloadJson.phrases`.
- Preview and apply require an existing Skill File.
- Starter rules cannot be edited through API routes.
- Global rule edit routes can only edit custom global rules. Brand rule edit routes can only edit custom rules whose `brandId` matches the route brand.
- Apply rejects a stored preview when the latest Skill File id/version differs from the preview base.

## Error Handling

- No Skill File: users can browse and save selections, but preview/apply explains that a Skill File must exist first.
- Invalid custom rule: show inline validation on the form and return `400` from the API.
- Stale preview: return a specific error and prompt the user to preview again.
- Disabled or deleted selected rule: show it as unavailable and omit it from compilation unless it is re-enabled.
- Empty selected set: preview returns no changes and apply is disabled.

## Testing

Unit tests:

- Compiler adds correct fields for each rule mode.
- Banned phrase rules update `avoidedPhrases` and `retrievalHints.avoidVocabulary`.
- Hard constraints enter `linguisticRules` and high-confidence `rules`.
- Guidance rules create structured `SkillRule` entries without over-hardening.
- Retrieval hint rules update the right retrieval arrays.
- Duplicate rules and phrases are removed case-insensitively.
- Applying the same rules twice is idempotent.
- Starter seed is stable and does not duplicate rows.

API tests:

- Selection save persists selected/unselected state.
- Preview stores a `RuleApplication` and does not create a Skill File version.
- Apply creates exactly one new Skill File version.
- Apply rejects stale previews.
- Starter rules cannot be edited.

UI tests:

- Brand rules page renders starter and custom rules.
- Selecting rules updates the preview.
- Applying rules shows success and links to Skill File and Studio.

## Migration And Seeding

Add the three models and enums in a Prisma migration. Add a seed helper for starter rules and call it from the existing seed flow. The seed should upsert by stable id so starter changes can be shipped safely.

Existing Skill Files need no migration. The first applied rules batch will create a new Skill File version using the current latest version as the base.

## Implementation Notes

- Use existing `parseJsonField`, `stringifyJsonField`, and `nextSkillVersion` helpers.
- Keep the compiler pure and testable. API routes should orchestrate database reads/writes only.
- Treat `RuleApplication.previewPatchJson` as an audit record. Recompute or verify before apply rather than trusting stale client state.
- Use the existing visual language: `PageHeader`, `spool-plate`, `spool-plate-soft`, `spool-button`, and `spool-field`.
- Avoid adding broad evaluator logic for every rule. Add deterministic checks only where the rule can be detected reliably, such as banned phrases and punctuation bans.

## Approved Decisions

- Use the full rules bank approach with real database tables.
- Support curated starter rules and custom user-authored rules.
- Support global reusable rules and brand-scoped rules.
- Use preview before apply.
- Use mixed enforcement modes.
- Add both `/rules` and `/brands/[brandId]/rules`, with the brand page as the main application surface.
