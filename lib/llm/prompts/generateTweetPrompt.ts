import { BANNED_AI_PHRASES } from "@/lib/constants";
import type { VoiceSkillFile } from "@/lib/types";

function unique(values: string[], limit = values.length) {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const normalized = value.trim();
    const key = normalized.toLowerCase();
    if (!normalized || seen.has(key)) continue;
    seen.add(key);
    result.push(normalized);
    if (result.length >= limit) break;
  }
  return result;
}

function hardConstraintsFromSkillFile(skillFile: VoiceSkillFile) {
  const learnedRules = unique([
    ...(skillFile.rules ?? [])
      .filter((rule) => rule.layer === "mechanics" || rule.layer === "feedback")
      .sort((a, b) => b.confidence - a.confidence)
      .map((rule) => rule.rule),
    ...(skillFile.linguisticRules ?? []),
  ], 14);
  const avoided = unique([...(skillFile.avoidedPhrases ?? []), ...BANNED_AI_PHRASES], 40);

  return [
    "Hard constraints:",
    ...learnedRules.map((rule) => `- ${rule}`),
    avoided.length > 0 ? `- Never use: ${avoided.join(", ")}` : "- Do not use generic AI filler.",
    "- Do not start with a numbered thread marker like 1/ or 2/ unless tweet type is thread.",
    "- Only use live, launch, available now, coming soon, or now supports when the context, notes, or tweet type explicitly says it.",
    "- If a hard constraint conflicts with a tempting example, obey the hard constraint.",
  ].join("\n");
}

export function voicePacketFromSkillFile({
  skillFile,
  examples,
  counterExamples,
}: {
  skillFile: VoiceSkillFile;
  examples: string[];
  counterExamples: string[];
}) {
  const topRules = (skillFile.rules ?? [])
    .slice()
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 12)
    .map((rule) => ({
      layer: rule.layer,
      rule: rule.rule,
      confidence: rule.confidence,
      evidence: rule.supportingExamples.slice(0, 3),
    }));

  return {
    version: skillFile.version,
    brandName: skillFile.brandName,
    voiceSummary: skillFile.voiceSummary,
    voiceKernel: skillFile.voiceKernel,
    topRules,
    preferredPhrases: (skillFile.preferredPhrases ?? []).slice(0, 16),
    avoidedPhrases: unique([...(skillFile.avoidedPhrases ?? []), ...BANNED_AI_PHRASES], 48),
    retrievalHints: skillFile.retrievalHints
      ? {
          preferredTopics: (skillFile.retrievalHints.preferredTopics ?? []).slice(0, 16),
          preferredStructures: (skillFile.retrievalHints.preferredStructures ?? []).slice(0, 12),
          preferredVocabulary: (skillFile.retrievalHints.preferredVocabulary ?? []).slice(0, 24),
          avoidVocabulary: (skillFile.retrievalHints.avoidVocabulary ?? []).slice(0, 32),
        }
      : undefined,
    selectedExamples: examples,
    counterExamples,
  };
}

export function generateTweetPrompt({
  context,
  tweetType,
  variations,
  notes,
  skillFile,
  examples,
  counterExamples = [],
}: {
  context: string;
  tweetType: string;
  variations: number;
  notes?: string;
  skillFile: VoiceSkillFile;
  examples: string[];
  counterExamples?: string[];
}) {
  const voicePacket = voicePacketFromSkillFile({ skillFile, examples, counterExamples });

  return `Generate ${variations} Twitter/X draft(s) in the brand voice.

Return only valid JSON in this shape:
{"tweets":[{"text":"tweet text","reason":"why it matches","issues":[],"suggestedRevisionDirection":"how to improve"}]}

${hardConstraintsFromSkillFile(skillFile)}

Context:
${context}

Tweet type:
${tweetType}

Optional notes:
${notes || "none"}

Relevant examples:
${examples.map((example, index) => `${index + 1}. ${example}`).join("\n")}

Counterexamples to avoid:
${counterExamples.length > 0 ? counterExamples.map((example, index) => `${index + 1}. ${example}`).join("\n") : "None."}

Voice packet:
${JSON.stringify(voicePacket, null, 2)}

Rules:
- Be Twitter-native: concise, specific, and natural.
- Do not use unnecessary hashtags.
- Do not invent metrics, customer names, dates, or claims.
- Do not sound corporate unless the skill file explicitly requires it.
- Avoid these phrases: ${BANNED_AI_PHRASES.join(", ")}.`;
}
