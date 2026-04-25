import { BANNED_AI_PHRASES, TWEET_TYPES } from "@/lib/constants";
import type { VoiceReport, VoiceSkillFile } from "@/lib/types";

type BrandInput = {
  name: string;
  audience?: string | null;
  beliefs?: string | null;
  avoidSoundingLike?: string | null;
};

function splitLines(value?: string | null) {
  return (value ?? "")
    .split(/\n|,/g)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function createVoiceSkillFile({
  version,
  brand,
  report,
}: {
  version: string;
  brand: BrandInput;
  report: VoiceReport;
}): VoiceSkillFile {
  const avoid = splitLines(brand.avoidSoundingLike);
  const firstAvoid = avoid[0] ?? "generic AI copy";

  return {
    version,
    brandName: brand.name,
    voiceSummary: report.summary,
    audience: splitLines(brand.audience),
    coreBeliefs: splitLines(brand.beliefs),
    coreVoiceIdentity: {
      traits: report.personalityTraits,
      thisNotThat: report.personalityTraits.slice(0, 5).map((trait) => ({
        this: trait,
        notThat: firstAvoid,
      })),
    },
    toneSliders: report.toneSliders,
    linguisticRules: [
      `Average tweet length should stay near ${report.linguisticMechanics.averageTweetLength} characters.`,
      `Sentence length tendency: ${report.linguisticMechanics.sentenceLength}.`,
      `Punctuation style: ${report.linguisticMechanics.punctuationStyle}.`,
      `Capitalization style: ${report.linguisticMechanics.capitalizationStyle}.`,
      `Line break style: ${report.linguisticMechanics.lineBreakStyle}.`,
      report.linguisticMechanics.usesEmojis
        ? `Emoji use is ${report.linguisticMechanics.emojiFrequency}.`
        : "Avoid emoji unless the context clearly benefits from one.",
    ],
    contextualToneRules: TWEET_TYPES.map((contentType) => ({
      contentType,
      rules: [
        "Stay grounded in the brand voice summary.",
        "Use concrete language and avoid generic AI phrasing.",
        "Do not invent metrics, customers, dates, or claims.",
      ],
    })),
    preferredPhrases: report.preferredPhrases,
    avoidedPhrases: Array.from(new Set([...report.avoidedPhrases, ...avoid, ...BANNED_AI_PHRASES])),
    tweetPatterns: report.contentPatterns.map((pattern) => ({
      name: pattern.name,
      structure: pattern.structure,
      example: report.exampleTweets[0],
    })),
    exampleLibrary: {
      onBrand: report.exampleTweets,
      offBrand: [],
      approvedGenerated: [],
      rejectedGenerated: [],
    },
    qualityRubric: {
      brandVoiceMatch: 35,
      twitterNativeness: 20,
      specificity: 15,
      hookQuality: 10,
      nonGeneric: 10,
      ctaFit: 5,
    },
    updatedAt: new Date().toISOString(),
  };
}
