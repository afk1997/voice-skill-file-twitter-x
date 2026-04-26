import type { SkillRule } from "@/lib/types";
import { NOTE_ONLY_FEEDBACK_LABEL, REJECT_FEEDBACK_LABEL } from "@/lib/voice/feedbackActions";

export type FeedbackSkillPatch = {
  ruleLayer: SkillRule["layer"];
  addedRules: string[];
  avoidedPhrases: string[];
  preferredPhrases: string[];
  retrievalAvoidVocabulary: string[];
  approvedExamples: string[];
  rejectedExamples: string[];
};

function unique(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

function mentionsEmDash(value: string) {
  return /\bem\s*[- ]?\s*dashes?\b|—/i.test(value);
}

function mentionsEmoji(value: string) {
  return /\bemoji|emojis\b/i.test(value);
}

function mentionsHashtag(value: string) {
  return /\bhash\s*tags?\b|#\w+/i.test(value);
}

function mentionsPolished(value: string) {
  return /\bpolished|corporate|announcement language\b/i.test(value);
}

function shouldReject(label: string) {
  return label !== "Sounds like us" && label !== NOTE_ONLY_FEEDBACK_LABEL;
}

function labelRules(label: string) {
  if (label === "Sounds like us") return ["Use approved generated examples as positive voice references."];
  if (label === REJECT_FEEDBACK_LABEL) return ["Reject drafts like this and use them as off-brand counterexamples."];
  if (label === "Too generic") return ["Prefer specific examples, concrete nouns, and sharper claims over broad advice."];
  if (label === "Too formal") return ["Use plainer, more conversational language without losing clarity."];
  if (label === "Too casual") return ["Preserve credibility and avoid throwaway casual phrasing."];
  if (label === "Too salesy") return ["Lead with evidence, context, or a useful observation before promotion."];
  if (label === "Too polished") return ["Avoid polished corporate announcement language."];
  if (label === "Too long") return ["Compress drafts until every sentence earns its place."];
  if (label === "Too much hype") return ["Remove superlatives, inflated claims, and hype-heavy phrasing."];
  if (label === "Wrong vocabulary") return ["Avoid vocabulary that does not sound like the brand."];
  if (label === "Good idea, wrong tone") return ["Keep the idea but revise tone toward approved examples before using it."];
  if (label === "Good tone, weak hook") return ["Strengthen the first line with a sharper claim, contrast, or concrete setup."];
  return [];
}

function labelAvoidedPhrases(label: string) {
  if (label === "Too polished") return ["we are excited to announce", "seamless", "game-changing"];
  if (label === "Too much hype") return ["revolutionary", "supercharge", "cutting-edge", "unlock the future"];
  return [];
}

export function compileFeedbackToSkillPatch({
  label,
  comment,
  generatedText,
}: {
  label: string;
  comment?: string | null;
  generatedText: string;
}): FeedbackSkillPatch {
  const note = comment?.trim() ?? "";
  const addedRules = [...labelRules(label)];
  const avoidedPhrases = [...labelAvoidedPhrases(label)];
  const preferredPhrases: string[] = [];
  const retrievalAvoidVocabulary: string[] = [];
  let ruleLayer: SkillRule["layer"] = "feedback";

  if (label === NOTE_ONLY_FEEDBACK_LABEL && note) {
    addedRules.push(`Apply this note when revising future drafts: ${note}`);
  }

  if (mentionsEmDash(note)) {
    ruleLayer = "mechanics";
    addedRules.push("Do not use em dashes in generated tweets. Use commas, periods, colons, or shorter sentences instead.");
    avoidedPhrases.push("—");
    retrievalAvoidVocabulary.push("—");
  }

  if (mentionsEmoji(note)) {
    ruleLayer = "mechanics";
    addedRules.push("Use fewer emojis; only include emoji when it adds brand-specific meaning.");
  }

  if (mentionsHashtag(note)) {
    ruleLayer = "mechanics";
    addedRules.push("Avoid hashtags unless the user explicitly asks for one or the brand context requires it.");
  }

  if (mentionsPolished(note) && label !== "Too polished") {
    addedRules.push("Avoid polished corporate announcement language.");
    avoidedPhrases.push("we are excited to announce", "seamless", "game-changing");
  }

  if (label === "Wrong vocabulary" && note) {
    avoidedPhrases.push(note);
    retrievalAvoidVocabulary.push(note);
  }

  return {
    ruleLayer,
    addedRules: unique(addedRules),
    avoidedPhrases: unique(avoidedPhrases),
    preferredPhrases: unique(preferredPhrases),
    retrievalAvoidVocabulary: unique(retrievalAvoidVocabulary),
    approvedExamples: label === "Sounds like us" ? unique([generatedText]) : [],
    rejectedExamples: shouldReject(label) ? unique([generatedText]) : [],
  };
}
