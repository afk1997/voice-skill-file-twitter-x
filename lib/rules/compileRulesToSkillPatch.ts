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
    layer: rule.mode === "retrieval_hint" || rule.mode === "guidance" ? "context" : "mechanics",
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
