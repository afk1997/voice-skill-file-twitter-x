import type { VoiceSkillFile } from "@/lib/types";

function unique(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

export function updateSkillFileFromFeedback({
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
}): VoiceSkillFile {
  const next: VoiceSkillFile = {
    ...skillFile,
    version: nextVersion,
    linguisticRules: [...skillFile.linguisticRules],
    preferredPhrases: [...skillFile.preferredPhrases],
    avoidedPhrases: [...skillFile.avoidedPhrases],
    exampleLibrary: {
      onBrand: [...skillFile.exampleLibrary.onBrand],
      offBrand: [...skillFile.exampleLibrary.offBrand],
      approvedGenerated: [...skillFile.exampleLibrary.approvedGenerated],
      rejectedGenerated: [...skillFile.exampleLibrary.rejectedGenerated],
    },
    updatedAt: new Date().toISOString(),
  };

  if (label === "Sounds like us") {
    next.exampleLibrary.approvedGenerated = unique([...next.exampleLibrary.approvedGenerated, generatedText]);
  }

  if (label === "Too generic") {
    next.linguisticRules.push("Prefer specific examples, concrete nouns, and sharper claims over broad advice.");
  }

  if (label === "Too polished") {
    next.linguisticRules.push("Avoid polished corporate announcement language.");
    next.avoidedPhrases.push("we are excited to announce", "seamless", "game-changing");
  }

  if (label === "Too formal") {
    next.linguisticRules.push("Use plainer, more conversational language without losing clarity.");
  }

  if (label === "Too casual") {
    next.linguisticRules.push("Preserve credibility and avoid throwaway casual phrasing.");
  }

  if (label === "Too salesy") {
    next.linguisticRules.push("Reduce promotional framing and lead with evidence, context, or a useful observation.");
  }

  if (label === "Too long") {
    next.linguisticRules.push("Compress drafts until every sentence earns its place.");
  }

  if (label === "Too much hype") {
    next.avoidedPhrases.push("revolutionary", "supercharge", "cutting-edge", "unlock the future");
  }

  if (label === "Wrong vocabulary" && comment) {
    next.avoidedPhrases.push(comment);
  }

  if (label === "Good idea, wrong tone") {
    next.exampleLibrary.rejectedGenerated = unique([...next.exampleLibrary.rejectedGenerated, generatedText]);
    next.linguisticRules.push("Keep the idea but revise tone toward the approved examples before using it.");
  }

  if (label === "Good tone, weak hook") {
    next.linguisticRules.push("Strengthen the first line with a sharper claim, contrast, or concrete setup.");
  }

  next.linguisticRules = unique(next.linguisticRules);
  next.avoidedPhrases = unique(next.avoidedPhrases);
  return next;
}
