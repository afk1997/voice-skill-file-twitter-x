import { BANNED_AI_PHRASES } from "@/lib/constants";

export type AnalyzeVoicePromptStats = {
  sampleCount: number;
  averageTweetLength: number;
  emojiFrequency: string;
  lineBreakRate: number;
  sentenceLength: string;
  punctuationStyle: string;
  capitalizationStyle: string;
  firstPersonUsage: string;
  secondPersonUsage: string;
};

export function analyzeVoicePrompt({
  brandName,
  samples,
  corpusStats,
  corpusProfile,
  analysisMode = "direct",
}: {
  brandName: string;
  samples: string[];
  corpusStats?: AnalyzeVoicePromptStats;
  corpusProfile?: unknown;
  analysisMode?: "direct" | "chunk";
}) {
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
  "exampleTweets": ["tweet"],
  "ruleEvidence": [
    {
      "rule": "specific style rule learned from repeated evidence",
      "confidence": 0,
      "evidence": [
        { "quote": "short exact quote from a sample", "reason": "why this quote supports the rule" }
      ]
    }
  ]
}

Anti-slop rules:
- Do not call this a generic AI tweet generator.
- Avoid vague adjectives unless supported by examples.
- Identify mechanics from the samples, not from assumptions.
- Preserve observations about line breaks, bullets, spacing, and thread formatting.
- Treat corpus stats as authoritative for mechanics. Use samples for qualitative patterns.
- Treat the corpus profile as authoritative for distribution, vocabulary, hooks, endings, and formatting evidence.
- Every ruleEvidence item must be grounded in exact sample quotes. Do not invent quotes.
- Analysis mode: ${analysisMode}.
- Treat these as avoided phrases: ${BANNED_AI_PHRASES.join(", ")}.

Corpus stats:
${corpusStats ? JSON.stringify(corpusStats, null, 2) : "Not available."}

Corpus profile:
${corpusProfile ? JSON.stringify(corpusProfile, null, 2) : "Not available."}

Samples:
${samples.map((sample, index) => `${index + 1}. ${sample}`).join("\n")}`;
}
