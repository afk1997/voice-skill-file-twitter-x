import { BANNED_AI_PHRASES } from "@/lib/constants";

export function analyzeVoicePrompt({ brandName, samples }: { brandName: string; samples: string[] }) {
  return `Analyze the Twitter/X writing voice for ${brandName}.

Return only valid JSON matching the VoiceReport type. Do not include markdown.

Anti-slop rules:
- Do not call this a generic AI tweet generator.
- Avoid vague adjectives unless supported by examples.
- Identify mechanics from the samples, not from assumptions.
- Treat these as avoided phrases: ${BANNED_AI_PHRASES.join(", ")}.

Samples:
${samples.map((sample, index) => `${index + 1}. ${sample}`).join("\n")}`;
}
