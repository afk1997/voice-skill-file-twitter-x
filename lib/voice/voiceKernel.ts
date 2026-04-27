import { BANNED_AI_PHRASES } from "@/lib/constants";
import type { VoiceKernel, VoiceReport } from "@/lib/types";
import type { CorpusProfile } from "@/lib/voice/corpusProfile";

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

function lengthBand(length: CorpusProfile["length"]): VoiceKernel["length"]["band"] {
  const spread = length.p75 - length.p25;
  if (spread >= 90) return "mixed";
  if (length.median >= 170) return "long";
  if (length.median <= 80) return "short";
  return "medium";
}

function ruleForLineBreaks(rate: number) {
  if (rate >= 45) return "Use multi-line formatting often; preserve the corpus rhythm instead of flattening every draft.";
  if (rate <= 10) return "Default to compact single-line tweets; use line breaks only when the brief requires structure.";
  return "Use line breaks selectively for contrast, lists, or emphasis.";
}

function ruleForEmoji(frequency: VoiceKernel["formatting"]["emojiFrequency"]) {
  if (frequency === "none") return "Avoid emojis unless the user explicitly asks for one.";
  if (frequency === "high") return "Emoji use is part of the voice, but keep it specific and sparse per draft.";
  return `Emoji use should remain ${frequency}; do not add decorative emoji by default.`;
}

function firstWords(value: string) {
  return value.split(/\s+/).slice(0, 8).join(" ");
}

export function buildVoiceKernel({
  corpusProfile,
  report,
  avoidedPhrases = [],
}: {
  corpusProfile: CorpusProfile;
  report?: VoiceReport;
  avoidedPhrases?: string[];
}): VoiceKernel {
  const idealRange: [number, number] = [corpusProfile.length.p25, corpusProfile.length.p75];
  const openingPatterns = unique(
    [
      ...(report?.hookPatterns ?? []),
      ...corpusProfile.hooks.map(firstWords),
    ],
    8,
  );
  const endingPatterns = unique(
    [
      ...(report?.endingPatterns ?? []),
      ...corpusProfile.endings.map(firstWords),
    ],
    8,
  );
  const preferredPhrases = unique(
    [
      ...(report?.preferredPhrases ?? []),
      ...corpusProfile.vocabulary.topPhrases.map((phrase) => phrase.text),
    ],
    16,
  );
  const forbiddenModelDefaults = unique([...avoidedPhrases, ...BANNED_AI_PHRASES], 40);

  return {
    sampleCount: corpusProfile.sampleCount,
    length: {
      idealRange,
      median: corpusProfile.length.median,
      p90: corpusProfile.length.p90,
      band: lengthBand(corpusProfile.length),
    },
    formatting: {
      lineBreakRate: corpusProfile.formatting.lineBreakRate,
      commonLineBreakTemplates: corpusProfile.formatting.commonLineBreakTemplates,
      emojiFrequency: corpusProfile.formatting.emojiFrequency,
      commonEmojis: corpusProfile.formatting.commonEmojis,
      hashtagRate: corpusProfile.formatting.hashtagRate,
      mentionRate: corpusProfile.formatting.mentionRate,
      urlRate: corpusProfile.formatting.urlRate,
    },
    rhythm: {
      openingPatterns,
      endingPatterns,
      punctuationHabit: corpusProfile.formatting.punctuationProfile,
      capitalizationHabit: corpusProfile.formatting.capitalizationProfile,
      firstPersonRate: corpusProfile.pronouns.firstPersonRate,
      secondPersonRate: corpusProfile.pronouns.secondPersonRate,
    },
    vocabulary: {
      preferredTerms: unique(corpusProfile.vocabulary.topTerms, 24),
      preferredPhrases,
      forbiddenModelDefaults,
    },
    stylometry: {
      topCharacterTrigrams: corpusProfile.stylometry.topCharacterTrigrams,
      punctuationDensity: corpusProfile.stylometry.punctuationDensity,
      averageWordCount: corpusProfile.stylometry.averageWordCount,
      questionRate: corpusProfile.stylometry.questionRate,
      exclamationRate: corpusProfile.stylometry.exclamationRate,
    },
    generationRules: [
      `Stay near ${idealRange[0]}-${idealRange[1]} characters unless the brief clearly needs a different length.`,
      ruleForLineBreaks(corpusProfile.formatting.lineBreakRate),
      ruleForEmoji(corpusProfile.formatting.emojiFrequency),
      corpusProfile.formatting.hashtagRate <= 5
        ? "Avoid hashtags unless the user explicitly asks for one."
        : "Use hashtags only when they match the corpus pattern and the brief.",
      `Match punctuation habit: ${corpusProfile.formatting.punctuationProfile}`,
      `Match capitalization habit: ${corpusProfile.formatting.capitalizationProfile}`,
    ],
  };
}
