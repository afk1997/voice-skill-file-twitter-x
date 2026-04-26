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
    "- If a hard constraint conflicts with a tempting example, obey the hard constraint.",
  ].join("\n");
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

Voice Skill File:
${JSON.stringify(skillFile, null, 2)}

Rules:
- Be Twitter-native: concise, specific, and natural.
- Do not use unnecessary hashtags.
- Do not invent metrics, customer names, dates, or claims.
- Do not sound corporate unless the skill file explicitly requires it.
- Avoid these phrases: ${BANNED_AI_PHRASES.join(", ")}.`;
}
