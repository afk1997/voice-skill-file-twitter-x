import type { VoiceSkillFile } from "@/lib/types";
import { hasAvailabilityClaim } from "@/lib/voice/requestClaims";

export type StyleDistanceResult = {
  score: number;
  issues: string[];
  metrics: {
    lengthFit: number;
    formatFit: number;
    vocabularyFit: number;
    stylometryFit: number;
    nearestExampleSimilarity: number;
  };
  nearestExample?: {
    text: string;
    similarity: number;
  };
};

const EMOJI_PATTERN = /\p{Extended_Pictographic}/u;
const THREAD_MARKER_PATTERN = /^\s*\d+\s*\//;

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function includesPhrase(text: string, phrase: string) {
  const normalized = phrase.trim().toLowerCase();
  if (!normalized) return false;
  if (/^[a-z0-9']+$/i.test(normalized)) return new RegExp(`\\b${escapeRegExp(normalized)}\\b`, "i").test(text);
  return text.includes(normalized);
}

function clampScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function ngrams(value: string, size = 3) {
  const normalized = value.toLowerCase().replace(/\s+/g, " ").trim();
  if (normalized.length <= size) return new Set(normalized ? [normalized] : []);
  const grams = new Set<string>();
  for (let index = 0; index <= normalized.length - size; index += 1) {
    grams.add(normalized.slice(index, index + size));
  }
  return grams;
}

function jaccard(source: Set<string>, target: Set<string>) {
  if (source.size === 0 || target.size === 0) return 0;
  let intersection = 0;
  for (const item of source) {
    if (target.has(item)) intersection += 1;
  }
  return intersection / (source.size + target.size - intersection);
}

function nearestExample(tweet: string, examples: string[]) {
  const tweetGrams = ngrams(tweet);
  return examples.reduce<{ text: string; similarity: number } | undefined>((best, example) => {
    const similarity = Math.round(jaccard(tweetGrams, ngrams(example)) * 100);
    if (!best || similarity > best.similarity) return { text: example, similarity };
    return best;
  }, undefined);
}

function lengthFit(tweetLength: number, idealRange: [number, number], p90: number) {
  const [min, max] = idealRange;
  if (tweetLength >= min && tweetLength <= max) return 100;
  if (tweetLength < min) return clampScore(100 - ((min - tweetLength) / Math.max(min, 1)) * 80);
  return clampScore(100 - ((tweetLength - max) / Math.max(p90 - max, 30)) * 70);
}

function vocabularyFit(tweet: string, preferredTerms: string[]) {
  if (preferredTerms.length === 0) return 80;
  const lower = tweet.toLowerCase();
  const matched = preferredTerms.filter((term) => includesPhrase(lower, term)).length;
  return clampScore(55 + (matched / Math.min(preferredTerms.length, 8)) * 45);
}

function wordCount(tweet: string) {
  return tweet.toLowerCase().match(/[a-z][a-z0-9']+/g)?.length ?? 0;
}

function punctuationDensity(tweet: string) {
  const length = Array.from(tweet).length;
  if (length === 0) return 0;
  return ((tweet.match(/[!?.,:;]/g) ?? []).length / length) * 100;
}

function rateMatch(hasFeature: boolean, corpusRate: number) {
  if (corpusRate >= 45) return hasFeature ? 100 : 55;
  if (corpusRate <= 5) return hasFeature ? 45 : 100;
  return hasFeature ? 85 : 75;
}

function stylometryFit(tweet: string, stylometry: NonNullable<VoiceSkillFile["voiceKernel"]>["stylometry"]) {
  if (!stylometry || stylometry.topCharacterTrigrams.length === 0) return 70;
  const tweetTrigrams = ngrams(tweet);
  const matchedTrigrams = stylometry.topCharacterTrigrams.filter((trigram) => tweetTrigrams.has(trigram)).length;
  const trigramFit = clampScore(45 + (matchedTrigrams / Math.min(stylometry.topCharacterTrigrams.length, 16)) * 55);
  const densityFit = clampScore(100 - Math.abs(punctuationDensity(tweet) - stylometry.punctuationDensity) * 8);
  const words = wordCount(tweet);
  const wordFit =
    stylometry.averageWordCount <= 0
      ? 70
      : clampScore(100 - (Math.abs(words - stylometry.averageWordCount) / Math.max(stylometry.averageWordCount, 1)) * 70);
  const questionFit = rateMatch(tweet.includes("?"), stylometry.questionRate);
  const exclamationFit = rateMatch(tweet.includes("!"), stylometry.exclamationRate);

  return clampScore(trigramFit * 0.36 + densityFit * 0.22 + wordFit * 0.22 + questionFit * 0.1 + exclamationFit * 0.1);
}

export function scoreStyleDistance({ tweet, skillFile }: { tweet: string; skillFile: VoiceSkillFile }): StyleDistanceResult {
  const kernel = skillFile.voiceKernel;
  if (!kernel) {
    return {
      score: 70,
      issues: ["No voice kernel available for local style-distance scoring"],
      metrics: { lengthFit: 70, formatFit: 70, vocabularyFit: 70, stylometryFit: 70, nearestExampleSimilarity: 0 },
    };
  }

  const lower = tweet.toLowerCase();
  const issues: string[] = [];
  const exampleCandidates = [...(skillFile.exampleLibrary?.onBrand ?? []), ...(skillFile.exampleLibrary?.approvedGenerated ?? [])];
  const nearestCandidates = exampleCandidates.filter((example) => {
    if (!hasAvailabilityClaim(tweet) && hasAvailabilityClaim(example)) return false;
    if (!THREAD_MARKER_PATTERN.test(tweet) && THREAD_MARKER_PATTERN.test(example)) return false;
    return true;
  });
  const nearest = nearestExample(tweet, nearestCandidates);
  const length = lengthFit(tweet.length, kernel.length.idealRange, kernel.length.p90);
  let format = 100;
  let vocabulary = vocabularyFit(tweet, kernel.vocabulary.preferredTerms);

  for (const phrase of kernel.vocabulary.forbiddenModelDefaults) {
    if (includesPhrase(lower, phrase)) {
      vocabulary -= 25;
      issues.push(`Uses model-default phrasing: ${phrase}`);
    }
  }

  if (kernel.formatting.emojiFrequency === "none" && EMOJI_PATTERN.test(tweet)) {
    format -= 25;
    issues.push("Uses emoji despite a no-emoji corpus pattern");
  }

  if (kernel.formatting.hashtagRate <= 5 && /#\w+/.test(tweet)) {
    format -= 25;
    issues.push("Uses hashtags despite a no-hashtag corpus pattern");
  }

  if (kernel.formatting.lineBreakRate <= 10 && tweet.includes("\n\n")) {
    format -= 15;
    issues.push("Uses blocky line breaks despite a compact corpus pattern");
  }

  if (kernel.formatting.lineBreakRate >= 45 && !tweet.includes("\n")) {
    format -= 12;
    issues.push("Flattens a corpus pattern that often uses line breaks");
  }

  const nearestScore = nearest?.similarity ?? 0;
  const metrics = {
    lengthFit: clampScore(length),
    formatFit: clampScore(format),
    vocabularyFit: clampScore(vocabulary),
    stylometryFit: stylometryFit(tweet, kernel.stylometry),
    nearestExampleSimilarity: nearestScore,
  };
  const score = clampScore(
    metrics.lengthFit * 0.24 +
      metrics.formatFit * 0.22 +
      metrics.vocabularyFit * 0.2 +
      metrics.stylometryFit * 0.14 +
      Math.max(55, metrics.nearestExampleSimilarity) * 0.2,
  );

  return {
    score,
    issues: Array.from(new Set(issues)),
    metrics,
    nearestExample: nearest,
  };
}
