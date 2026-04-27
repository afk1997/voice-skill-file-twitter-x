import type { VoiceSkillFile } from "@/lib/types";
import { compileFeedbackToSkillPatch, type FeedbackSkillPatch } from "@/lib/voice/compileFeedback";

function unique(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

function slug(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 56);
}

export function updateSkillFileFromFeedbackWithSummary({
  skillFile,
  nextVersion,
  generatedText,
  label,
  comment,
}: {
  skillFile: VoiceSkillFile;
  nextVersion: string;
  generatedText: string;
  label: string;
  comment?: string | null;
}): { skillFile: VoiceSkillFile; changes: FeedbackSkillPatch } {
  const changes = compileFeedbackToSkillPatch({ label, comment, generatedText });
  const next: VoiceSkillFile & {
    retrievalHints: NonNullable<VoiceSkillFile["retrievalHints"]>;
    rules: NonNullable<VoiceSkillFile["rules"]>;
  } = {
    ...skillFile,
    version: nextVersion,
    linguisticRules: [...skillFile.linguisticRules],
    preferredPhrases: [...skillFile.preferredPhrases],
    avoidedPhrases: [...skillFile.avoidedPhrases],
    rules: [...(skillFile.rules ?? [])],
    retrievalHints: {
      preferredTopics: [...(skillFile.retrievalHints?.preferredTopics ?? [])],
      preferredStructures: [...(skillFile.retrievalHints?.preferredStructures ?? [])],
      preferredVocabulary: [...(skillFile.retrievalHints?.preferredVocabulary ?? [])],
      avoidVocabulary: [...(skillFile.retrievalHints?.avoidVocabulary ?? [])],
    },
    exampleLibrary: {
      onBrand: [...skillFile.exampleLibrary.onBrand],
      offBrand: [...skillFile.exampleLibrary.offBrand],
      approvedGenerated: [...skillFile.exampleLibrary.approvedGenerated],
      rejectedGenerated: [...skillFile.exampleLibrary.rejectedGenerated],
    },
    updatedAt: new Date().toISOString(),
  };

  next.linguisticRules.push(...changes.addedRules);
  next.avoidedPhrases.push(...changes.avoidedPhrases);
  next.preferredPhrases.push(...changes.preferredPhrases);
  next.retrievalHints.avoidVocabulary.push(...changes.retrievalAvoidVocabulary, ...changes.avoidedPhrases);
  next.exampleLibrary.approvedGenerated = unique([...next.exampleLibrary.approvedGenerated, ...changes.approvedExamples]);
  next.exampleLibrary.rejectedGenerated = unique([...next.exampleLibrary.rejectedGenerated, ...changes.rejectedExamples]);

  next.linguisticRules = unique(next.linguisticRules);
  next.avoidedPhrases = unique(next.avoidedPhrases);
  next.preferredPhrases = unique(next.preferredPhrases);
  next.retrievalHints.preferredTopics = unique(next.retrievalHints.preferredTopics);
  next.retrievalHints.preferredStructures = unique(next.retrievalHints.preferredStructures);
  next.retrievalHints.preferredVocabulary = unique(next.retrievalHints.preferredVocabulary);
  next.retrievalHints.avoidVocabulary = unique(next.retrievalHints.avoidVocabulary);
  next.rules = uniqueRules([
    ...next.rules,
    ...changes.addedRules.map((rule) => ({
      id: `feedback-${slug(label)}-${slug(rule).slice(0, 18)}-${slug(generatedText).slice(0, 12)}`,
      layer: changes.ruleLayer,
      rule,
      confidence: label === "Sounds like us" ? 86 : 84,
      supportingExamples: changes.approvedExamples,
      counterExamples: changes.rejectedExamples,
      appliesTo: ["all"],
    })),
  ]);
  return { skillFile: next, changes };
}

export function updateSkillFileFromFeedback(input: Parameters<typeof updateSkillFileFromFeedbackWithSummary>[0]): VoiceSkillFile {
  return updateSkillFileFromFeedbackWithSummary(input).skillFile;
}

export function previewSkillFileFeedbackUpdate(input: Parameters<typeof updateSkillFileFromFeedbackWithSummary>[0]) {
  const { skillFile, changes } = updateSkillFileFromFeedbackWithSummary(input);

  return {
    version: input.nextVersion,
    updatedSkillFile: skillFile,
    changes,
    items: [
      ...changes.addedRules.map((rule) => `Add rule: ${rule}`),
      ...changes.avoidedPhrases.map((phrase) => `Avoid phrase: ${phrase}`),
      ...changes.preferredPhrases.map((phrase) => `Prefer phrase: ${phrase}`),
      ...changes.approvedExamples.map(() => "Save draft as approved example."),
      ...changes.rejectedExamples.map(() => "Save draft as rejected counterexample."),
      ...changes.retrievalAvoidVocabulary.map((phrase) => `Avoid retrieving vocabulary: ${phrase}`),
    ],
  };
}

function uniqueRules(rules: NonNullable<VoiceSkillFile["rules"]>) {
  const seen = new Set<string>();
  const result: NonNullable<VoiceSkillFile["rules"]> = [];

  for (const rule of rules) {
    const key = `${rule.layer}:${rule.rule}:${rule.supportingExamples.join("|")}:${rule.counterExamples.join("|")}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(rule);
  }

  return result;
}
