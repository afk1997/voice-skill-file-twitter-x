import { BANNED_AI_PHRASES, TWEET_TYPES } from "@/lib/constants";
import type { SkillRule, VoiceReport, VoiceSkillFile } from "@/lib/types";
import type { CorpusProfile } from "@/lib/voice/corpusProfile";

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

function slug(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 48);
}

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

function buildRules(report: VoiceReport, corpusProfile?: CorpusProfile): SkillRule[] {
  const examples = unique(
    [
      ...report.exampleTweets,
      ...(corpusProfile?.representativeExamples.map((example) => example.text) ?? []),
    ],
    6,
  );
  const rules: SkillRule[] = [
    ...report.personalityTraits.slice(0, 6).map((trait) => ({
      id: `identity-${slug(trait)}`,
      layer: "identity" as const,
      rule: `Sound ${trait}; make this trait visible through phrasing, structure, and specificity.`,
      confidence: 82,
      supportingExamples: examples.slice(0, 3),
      counterExamples: [],
      appliesTo: ["all"],
    })),
    {
      id: "mechanics-formatting",
      layer: "mechanics",
      rule: `Preserve mechanics: ${report.linguisticMechanics.lineBreakStyle} ${report.linguisticMechanics.punctuationStyle}`,
      confidence: 88,
      supportingExamples: examples.slice(0, 3),
      counterExamples: [],
      appliesTo: ["all"],
    },
    ...report.contentPatterns.slice(0, 6).map((pattern) => ({
      id: `context-${slug(pattern.name)}`,
      layer: "context" as const,
      rule: `${pattern.name}: ${pattern.structure}`,
      confidence: 78,
      supportingExamples: examples.slice(0, 2),
      counterExamples: [],
      appliesTo: TWEET_TYPES,
    })),
  ];

  return rules;
}

export function createVoiceSkillFile({
  version,
  brand,
  report,
  corpusProfile,
  generatedWith,
}: {
  version: string;
  brand: BrandInput;
  report: VoiceReport;
  corpusProfile?: CorpusProfile;
  generatedWith?: string;
}): VoiceSkillFile {
  const avoid = splitLines(brand.avoidSoundingLike);
  const firstAvoid = avoid[0] ?? "generic AI copy";
  const preferredVocabulary = unique(
    [
      ...report.preferredPhrases.flatMap((phrase) => phrase.split(/\s+/)),
      ...(corpusProfile?.vocabulary.topTerms ?? []),
    ],
    24,
  );

  return {
    schemaVersion: "2.0",
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
    modelNotes: {
      preferredQualityModel: "claude-sonnet-4-6",
      generatedWith,
      corpusSampleCount: corpusProfile?.sampleCount ?? report.exampleTweets.length,
    },
    corpusProfile: corpusProfile ? (corpusProfile as unknown as Record<string, unknown>) : undefined,
    rules: buildRules(report, corpusProfile),
    retrievalHints: {
      preferredTopics: unique(corpusProfile?.vocabulary.topTerms ?? [], 16),
      preferredStructures: unique(report.contentPatterns.map((pattern) => pattern.structure), 12),
      preferredVocabulary,
      avoidVocabulary: unique([...report.avoidedPhrases, ...avoid, ...BANNED_AI_PHRASES], 32),
    },
    updatedAt: new Date().toISOString(),
  };
}
