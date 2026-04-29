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

function skillRuleSignature(rule: SkillRule) {
  return JSON.stringify({
    id: rule.id,
    layer: rule.layer,
    rule: rule.rule,
    confidence: rule.confidence,
    supportingExamples: rule.supportingExamples ?? [],
    counterExamples: rule.counterExamples ?? [],
    appliesTo: rule.appliesTo ?? [],
  });
}

function skillRuleChanged(existing: SkillRule | undefined, incoming: SkillRule) {
  return !existing || skillRuleSignature(existing) !== skillRuleSignature(incoming);
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
  const existingSkillRules = new Map((skillFile.rules ?? []).map((rule) => [rule.id, rule]));
  const linguisticModes = new Map<string, RuleBankRuleInput["mode"]>();

  for (const rule of activeRules) {
    const body = ruleBody(rule, selections);
    const confidenceValue = confidence(rule, selections);

    if (hasTarget(rule, "skill_rules")) {
      const skillRule = createSkillRule(rule, body, confidenceValue);
      if (skillRuleChanged(existingSkillRules.get(skillRule.id), skillRule)) {
        patch.skillRules.push(skillRule);
        items.push(existingSkillRules.has(skillRule.id) ? `Update rule: ${body}` : rule.mode === "hard_constraint" ? `Add hard constraint: ${body}` : `Add rule: ${body}`);
      }
    }

    if (hasTarget(rule, "linguistic_rules")) {
      patch.linguisticRules.push(body);
      linguisticModes.set(body.trim().toLowerCase(), rule.mode);
    }

    if (rule.mode === "banned_phrase" || hasTarget(rule, "avoided_phrases")) {
      patch.avoidedPhrases.push(...(rule.payloadJson.phrases ?? []));
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

  for (const body of patch.linguisticRules) {
    const label = linguisticModes.get(body.trim().toLowerCase()) === "hard_constraint" ? `Add hard constraint: ${body}` : `Add linguistic rule: ${body}`;
    if (!items.includes(label)) items.push(label);
  }
  for (const phrase of patch.avoidedPhrases) items.push(`Avoid phrase: ${phrase}`);
  for (const topic of patch.retrievalHints.preferredTopics) items.push(`Add preferred topic: ${topic}`);
  for (const structure of patch.retrievalHints.preferredStructures) items.push(`Add preferred structure: ${structure}`);
  for (const word of patch.retrievalHints.preferredVocabulary) items.push(`Add preferred vocabulary: ${word}`);
  for (const word of patch.retrievalHints.avoidVocabulary) items.push(`Add avoided vocabulary: ${word}`);

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
