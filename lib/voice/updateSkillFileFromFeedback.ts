import type { VoiceSkillFile } from "@/lib/types";

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

function feedbackRuleText(label: string, comment?: string | null) {
  if (label === "Sounds like us") return "Use approved generated examples as positive voice references.";
  if (label === "Too generic") return "Prefer concrete nouns, specific examples, and sharper claims over broad advice.";
  if (label === "Too formal") return "Use plainer, more conversational language without losing clarity.";
  if (label === "Too casual") return "Preserve credibility and avoid throwaway casual phrasing.";
  if (label === "Too salesy") return "Lead with evidence, context, or a useful observation before promotion.";
  if (label === "Too polished") return "Avoid polished corporate announcement language.";
  if (label === "Too long") return "Compress drafts until every sentence earns its place.";
  if (label === "Too much hype") return "Remove superlatives, inflated claims, and hype-heavy phrasing.";
  if (label === "Wrong vocabulary") return `Avoid vocabulary that does not sound like the brand${comment ? `: ${comment}` : "."}`;
  if (label === "Good idea, wrong tone") return "Keep the idea but revise tone toward approved examples before using it.";
  if (label === "Good tone, weak hook") return "Strengthen the first line with a sharper claim, contrast, or concrete setup.";
  return "Apply this feedback when generating future drafts.";
}

function shouldReject(label: string) {
  return label !== "Sounds like us";
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

  if (label === "Sounds like us") {
    next.exampleLibrary.approvedGenerated = unique([...next.exampleLibrary.approvedGenerated, generatedText]);
  }

  if (shouldReject(label)) {
    next.exampleLibrary.rejectedGenerated = unique([...next.exampleLibrary.rejectedGenerated, generatedText]);
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
    next.retrievalHints.avoidVocabulary.push(comment);
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
  next.retrievalHints.preferredTopics = unique(next.retrievalHints.preferredTopics);
  next.retrievalHints.preferredStructures = unique(next.retrievalHints.preferredStructures);
  next.retrievalHints.preferredVocabulary = unique(next.retrievalHints.preferredVocabulary);
  next.retrievalHints.avoidVocabulary = unique(next.retrievalHints.avoidVocabulary);
  next.rules = uniqueRules([
    ...next.rules,
    {
      id: `feedback-${slug(label)}-${slug(generatedText).slice(0, 18)}`,
      layer: "feedback",
      rule: feedbackRuleText(label, comment),
      confidence: label === "Sounds like us" ? 86 : 82,
      supportingExamples: label === "Sounds like us" ? [generatedText] : [],
      counterExamples: label === "Sounds like us" ? [] : [generatedText],
      appliesTo: ["all"],
    },
  ]);
  return next;
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
