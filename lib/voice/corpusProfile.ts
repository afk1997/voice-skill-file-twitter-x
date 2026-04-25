import { BANNED_AI_PHRASES } from "@/lib/constants";

export type CorpusProfileInput = {
  cleanedText: string;
  qualityScore: number;
  classification?: string;
};

export type CorpusProfile = {
  sampleCount: number;
  length: {
    average: number;
    median: number;
    p25: number;
    p75: number;
    p90: number;
  };
  formatting: {
    lineBreakRate: number;
    commonLineBreakTemplates: string[];
    emojiFrequency: "none" | "low" | "medium" | "high";
    commonEmojis: string[];
    punctuationProfile: string;
    capitalizationProfile: string;
  };
  pronouns: {
    firstPersonRate: number;
    secondPersonRate: number;
  };
  vocabulary: {
    topTerms: string[];
    topPhrases: {
      text: string;
      count: number;
    }[];
    avoidedSignals: string[];
  };
  hooks: string[];
  endings: string[];
  representativeExamples: {
    text: string;
    qualityScore: number;
    reason: string;
  }[];
};

const STOP_WORDS = new Set([
  "the",
  "and",
  "for",
  "that",
  "with",
  "this",
  "are",
  "you",
  "your",
  "our",
  "from",
  "into",
  "when",
  "they",
  "about",
  "have",
  "has",
  "was",
  "were",
  "but",
  "not",
  "can",
  "will",
  "what",
  "why",
  "how",
]);

const EMOJI_PATTERN = /\p{Extended_Pictographic}/gu;
const WORD_PATTERN = /[a-z][a-z0-9']+/g;

function visibleLength(value: string) {
  return Array.from(value).length;
}

function percentile(sorted: number[], percentileValue: number) {
  if (sorted.length === 0) return 0;
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil((percentileValue / 100) * sorted.length) - 1));
  return sorted[index];
}

function usageRate(count: number, total: number) {
  if (total === 0) return 0;
  return Math.round((count / total) * 100);
}

function classifyEmojiFrequency(emojiCount: number, sampleCount: number): CorpusProfile["formatting"]["emojiFrequency"] {
  if (emojiCount === 0 || sampleCount === 0) return "none";
  const rate = emojiCount / sampleCount;
  if (rate >= 0.75) return "high";
  if (rate >= 0.3) return "medium";
  return "low";
}

function lineBreakTemplate(text: string) {
  return text
    .split("\n")
    .map((line) => {
      if (!line.trim()) return "<blank>";
      if (/^\s*\d+[.)]/.test(line)) return "<numbered>";
      if (/^\s*[-*•]/.test(line)) return "<bullet>";
      return "<line>";
    })
    .join("\n");
}

function wordsFor(text: string) {
  return text.toLowerCase().match(WORD_PATTERN) ?? [];
}

function topMapEntries(map: Map<string, number>, limit: number) {
  return Array.from(map.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit);
}

function firstSentence(text: string) {
  return text.split(/\n|[.!?]/).find((part) => part.trim())?.trim() ?? text.trim();
}

function lastSentence(text: string) {
  return text
    .split(/\n|[.!?]/)
    .map((part) => part.trim())
    .filter(Boolean)
    .at(-1) ?? text.trim();
}

function punctuationProfile(samples: string[]) {
  const joined = samples.join("\n");
  const questionCount = (joined.match(/\?/g) ?? []).length;
  const exclamationCount = (joined.match(/!/g) ?? []).length;
  const listCount = (joined.match(/(^|\n)\s*(?:[-*•]|\d+[.)])/g) ?? []).length;

  if (listCount >= Math.max(2, samples.length * 0.1)) return "Uses list markers, numbering, or bullet-like punctuation for scannability.";
  if (questionCount > exclamationCount) return "Uses questions more often than hype punctuation.";
  if (exclamationCount > samples.length * 0.3) return "Uses exclamation points for launch energy or emphasis.";
  return "Mostly clean sentence punctuation with minimal ornamentation.";
}

function capitalizationProfile(samples: string[]) {
  const uppercaseTerms = samples.join(" ").match(/\b[A-Z]{3,}\b/g) ?? [];
  if (uppercaseTerms.length >= Math.max(2, samples.length * 0.08)) return "Uses occasional all-caps terms for product, protocol, or emphasis.";
  return "Mostly standard capitalization.";
}

export function buildCorpusProfile(samples: CorpusProfileInput[]): CorpusProfile {
  const cleanSamples = samples
    .map((sample) => ({ ...sample, cleanedText: sample.cleanedText.trim() }))
    .filter((sample) => sample.cleanedText.length > 0);
  const sampleTexts = cleanSamples.map((sample) => sample.cleanedText);
  const lengths = sampleTexts.map(visibleLength).sort((a, b) => a - b);
  const average = lengths.length === 0 ? 0 : Math.round(lengths.reduce((total, length) => total + length, 0) / lengths.length);
  const lineBreakSamples = cleanSamples.filter((sample) => sample.cleanedText.includes("\n"));
  const emojiMatches = sampleTexts.flatMap((sample) => sample.match(EMOJI_PATTERN) ?? []);
  const termCounts = new Map<string, number>();
  const phraseCounts = new Map<string, number>();

  for (const sample of sampleTexts) {
    const words = wordsFor(sample);
    for (const word of words) {
      if (word.length < 3 || STOP_WORDS.has(word)) continue;
      termCounts.set(word, (termCounts.get(word) ?? 0) + 1);
    }

    for (let index = 0; index < words.length - 1; index += 1) {
      const first = words[index];
      const second = words[index + 1];
      if (STOP_WORDS.has(first) || STOP_WORDS.has(second)) continue;
      const phrase = `${first} ${second}`;
      phraseCounts.set(phrase, (phraseCounts.get(phrase) ?? 0) + 1);
    }
  }

  const repeatedPhrases = topMapEntries(phraseCounts, 20).map(([text, count]) => ({ text, count }));
  const templates = Array.from(new Set(lineBreakSamples.map((sample) => lineBreakTemplate(sample.cleanedText)))).slice(0, 8);

  return {
    sampleCount: cleanSamples.length,
    length: {
      average,
      median: percentile(lengths, 50),
      p25: percentile(lengths, 25),
      p75: percentile(lengths, 75),
      p90: percentile(lengths, 90),
    },
    formatting: {
      lineBreakRate: usageRate(lineBreakSamples.length, cleanSamples.length),
      commonLineBreakTemplates: templates,
      emojiFrequency: classifyEmojiFrequency(emojiMatches.length, cleanSamples.length),
      commonEmojis: topMapEntries(
        emojiMatches.reduce((map, emoji) => map.set(emoji, (map.get(emoji) ?? 0) + 1), new Map<string, number>()),
        8,
      ).map(([emoji]) => emoji),
      punctuationProfile: punctuationProfile(sampleTexts),
      capitalizationProfile: capitalizationProfile(sampleTexts),
    },
    pronouns: {
      firstPersonRate: usageRate(cleanSamples.filter((sample) => /\b(i|i'm|i've|we|we're|we've|our|ours|us)\b/i.test(sample.cleanedText)).length, cleanSamples.length),
      secondPersonRate: usageRate(cleanSamples.filter((sample) => /\b(you|your|yours|you're|you've)\b/i.test(sample.cleanedText)).length, cleanSamples.length),
    },
    vocabulary: {
      topTerms: topMapEntries(termCounts, 24).map(([term]) => term),
      topPhrases: repeatedPhrases,
      avoidedSignals: BANNED_AI_PHRASES.filter((phrase) => sampleTexts.some((sample) => sample.toLowerCase().includes(phrase.toLowerCase()))),
    },
    hooks: Array.from(new Set(cleanSamples.map((sample) => firstSentence(sample.cleanedText)).filter(Boolean))).slice(0, 16),
    endings: Array.from(new Set(cleanSamples.map((sample) => lastSentence(sample.cleanedText)).filter(Boolean))).slice(0, 16),
    representativeExamples: cleanSamples
      .slice()
      .sort((a, b) => b.qualityScore - a.qualityScore)
      .slice(0, 16)
      .map((sample) => ({
        text: sample.cleanedText,
        qualityScore: sample.qualityScore,
        reason: sample.cleanedText.includes("\n")
          ? "High-quality sample with preserved multi-line formatting."
          : "High-quality useful sample with clear voice signal.",
      })),
  };
}
