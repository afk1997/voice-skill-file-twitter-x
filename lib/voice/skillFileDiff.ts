import type { VoiceSkillFile } from "@/lib/types";

export type SkillFileDiff = {
  title: string;
  items: string[];
};

function addedValues(previous: string[] = [], current: string[] = []) {
  const previousSet = new Set(previous.map((value) => value.toLowerCase()));
  return current.filter((value) => !previousSet.has(value.toLowerCase()));
}

function countDelta(previous = 0, current = 0) {
  return current - previous;
}

export function diffSkillFiles({ previous, current }: { previous: VoiceSkillFile; current: VoiceSkillFile }): SkillFileDiff {
  const addedLinguisticRules = addedValues(previous.linguisticRules, current.linguisticRules);
  const addedAvoided = addedValues(previous.avoidedPhrases, current.avoidedPhrases);
  const addedPreferred = addedValues(previous.preferredPhrases, current.preferredPhrases);
  const previousRules = new Set((previous.rules ?? []).map((rule) => rule.rule.toLowerCase()));
  const addedRules = (current.rules ?? []).filter((rule) => !previousRules.has(rule.rule.toLowerCase()));
  const approvedDelta = countDelta(previous.exampleLibrary?.approvedGenerated?.length, current.exampleLibrary?.approvedGenerated?.length);
  const rejectedDelta = countDelta(previous.exampleLibrary?.rejectedGenerated?.length, current.exampleLibrary?.rejectedGenerated?.length);

  return {
    title: `${previous.version} -> ${current.version}`,
    items: [
      ...addedLinguisticRules.map((rule) => `Added linguistic rule: ${rule}`),
      ...addedAvoided.map((phrase) => `Added avoided phrase: ${phrase}`),
      ...addedPreferred.map((phrase) => `Added preferred phrase: ${phrase}`),
      ...addedRules.map((rule) => `Added structured rule: ${rule.rule}`),
      ...(approvedDelta > 0 ? [`Approved examples: +${approvedDelta}`] : []),
      ...(rejectedDelta > 0 ? [`Rejected examples: +${rejectedDelta}`] : []),
      previous.voiceKernel || !current.voiceKernel ? "" : "Added voice kernel from corpus profile.",
    ].filter(Boolean),
  };
}
