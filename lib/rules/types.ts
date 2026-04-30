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
  userProfileId?: string | null;
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
