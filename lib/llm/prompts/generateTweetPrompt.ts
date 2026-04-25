import { BANNED_AI_PHRASES } from "@/lib/constants";
import type { VoiceSkillFile } from "@/lib/types";

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

Context:
${context}

Tweet type:
${tweetType}

Optional notes:
${notes || "none"}

Voice Skill File:
${JSON.stringify(skillFile, null, 2)}

Relevant examples:
${examples.map((example, index) => `${index + 1}. ${example}`).join("\n")}

Counterexamples to avoid:
${counterExamples.length > 0 ? counterExamples.map((example, index) => `${index + 1}. ${example}`).join("\n") : "None."}

Rules:
- Be Twitter-native: concise, specific, and natural.
- Do not use unnecessary hashtags.
- Do not invent metrics, customer names, dates, or claims.
- Do not sound corporate unless the skill file explicitly requires it.
- Avoid these phrases: ${BANNED_AI_PHRASES.join(", ")}.`;
}
