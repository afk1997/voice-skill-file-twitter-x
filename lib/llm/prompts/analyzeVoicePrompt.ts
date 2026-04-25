import { BANNED_AI_PHRASES } from "@/lib/constants";

export function analyzeVoicePrompt({ brandName, samples }: { brandName: string; samples: string[] }) {
  return `Analyze the Twitter/X writing voice for ${brandName}.

Return only valid JSON. Do not include markdown or commentary.

Use this exact JSON shape. Tone slider values must be integers from 0 to 100, not a 1-5 scale:
{
  "summary": "2-4 sentence voice summary grounded in the samples",
  "personalityTraits": ["trait"],
  "toneSliders": {
    "formalToCasual": 0,
    "seriousToFunny": 0,
    "respectfulToIrreverent": 0,
    "enthusiasticToMatterOfFact": 0,
    "simpleToComplex": 0,
    "warmToDetached": 0
  },
  "linguisticMechanics": {
    "averageTweetLength": 0,
    "sentenceLength": "short",
    "usesEmojis": false,
    "emojiFrequency": "none",
    "punctuationStyle": "description",
    "capitalizationStyle": "description",
    "lineBreakStyle": "description",
    "firstPersonUsage": "low",
    "secondPersonUsage": "low"
  },
  "hookPatterns": ["pattern"],
  "endingPatterns": ["pattern"],
  "preferredPhrases": ["phrase"],
  "avoidedPhrases": ["phrase"],
  "contentPatterns": [
    { "name": "pattern name", "description": "what it does", "structure": "how it is formatted" }
  ],
  "exampleTweets": ["tweet"]
}

Anti-slop rules:
- Do not call this a generic AI tweet generator.
- Avoid vague adjectives unless supported by examples.
- Identify mechanics from the samples, not from assumptions.
- Preserve observations about line breaks, bullets, spacing, and thread formatting.
- Treat these as avoided phrases: ${BANNED_AI_PHRASES.join(", ")}.

Samples:
${samples.map((sample, index) => `${index + 1}. ${sample}`).join("\n")}`;
}
