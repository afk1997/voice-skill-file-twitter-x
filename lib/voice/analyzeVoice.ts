import {
  DEFAULT_HIGH_CONTEXT_WINDOW_TOKENS,
  DEFAULT_LOW_CONTEXT_WINDOW_TOKENS,
  HIGH_CONTEXT_ANALYSIS_THRESHOLD_TOKENS,
  MAX_ANALYSIS_SAMPLES,
  MAX_CHUNKED_ANALYSIS_SAMPLE_CHARS,
  MAX_DIRECT_ANALYSIS_SAMPLE_CHARS,
  MAX_LLM_ANALYSIS_SAMPLE_CHARS,
} from "@/lib/constants";
import { generateJsonWithLlm, hasUsableProvider } from "@/lib/llm/client";
import { analyzeVoicePrompt } from "@/lib/llm/prompts/analyzeVoicePrompt";
import type { LlmProviderConfig, VoiceReport } from "@/lib/types";
import { buildCorpusProfile } from "@/lib/voice/corpusProfile";

type BrandInput = {
  name: string;
  audience?: string | null;
  beliefs?: string | null;
};

type SampleInput = {
  cleanedText: string;
  qualityScore: number;
};

type VoiceAnalysisMode = "direct" | "chunked";

export type CorpusVoiceStats = {
  sampleCount: number;
  averageTweetLength: number;
  sentenceLength: "short" | "medium" | "long" | "mixed";
  usesEmojis: boolean;
  emojiFrequency: "none" | "low" | "medium" | "high";
  lineBreakRate: number;
  lineBreakStyle: string;
  punctuationStyle: string;
  capitalizationStyle: string;
  firstPersonUsage: "low" | "medium" | "high";
  secondPersonUsage: "low" | "medium" | "high";
};

export type VoiceAnalysisStrategy = {
  mode: VoiceAnalysisMode;
  contextWindowTokens: number;
  sampleCharBudget: number;
  chunkCharBudget: number;
  maxChunks: number;
};

const TONE_KEYS = [
  "formalToCasual",
  "seriousToFunny",
  "respectfulToIrreverent",
  "enthusiasticToMatterOfFact",
  "simpleToComplex",
  "warmToDetached",
] as const;

const DEFAULT_TONE_SLIDERS: VoiceReport["toneSliders"] = {
  formalToCasual: 55,
  seriousToFunny: 35,
  respectfulToIrreverent: 35,
  enthusiasticToMatterOfFact: 45,
  simpleToComplex: 45,
  warmToDetached: 45,
};

const EMOJI_PATTERN = /\p{Extended_Pictographic}/u;
const FIRST_PERSON_PATTERN = /\b(i|i'm|i've|we|we're|we've|our|ours|us)\b/i;
const SECOND_PERSON_PATTERN = /\b(you|your|yours|you're|you've)\b/i;

function visibleLength(value: string) {
  return Array.from(value).length;
}

function usageFrequency(count: number, total: number): "low" | "medium" | "high" {
  if (total === 0) return "low";
  const rate = count / total;
  if (rate >= 0.45) return "high";
  if (rate >= 0.2) return "medium";
  return "low";
}

function emojiFrequency(count: number, total: number): CorpusVoiceStats["emojiFrequency"] {
  if (count === 0 || total === 0) return "none";
  const rate = count / total;
  if (rate >= 0.6) return "high";
  if (rate >= 0.25) return "medium";
  return "low";
}

function sentenceLengthFromAverage(averageTweetLength: number, lengths: number[]): CorpusVoiceStats["sentenceLength"] {
  const hasShort = lengths.some((length) => length < 80);
  const hasLong = lengths.some((length) => length > 180);
  if (hasShort && hasLong) return "mixed";
  if (averageTweetLength > 180) return "long";
  if (averageTweetLength > 90) return "medium";
  return "short";
}

function describeLineBreakStyle(rate: number) {
  if (rate >= 50) return "Frequent line breaks; preserve multi-line formatting and list spacing.";
  if (rate >= 20) return "Occasional line breaks for emphasis or scannable structure.";
  return "Mostly single-line tweets with sparse line breaks.";
}

function describePunctuation(samples: string[]) {
  const joined = samples.join("\n");
  const bulletCount = (joined.match(/(^|\n)\s*[-*•\d]+[.)]?\s+/g) ?? []).length;
  const exclamationCount = (joined.match(/!/g) ?? []).length;
  const questionCount = (joined.match(/\?/g) ?? []).length;
  if (bulletCount >= Math.max(2, samples.length * 0.1)) return "Uses bullets, numbered points, or list-like punctuation for scannability.";
  if (questionCount > exclamationCount) return "Uses questions more often than hype punctuation.";
  if (exclamationCount > samples.length * 0.3) return "Uses exclamation points for announcements and energy.";
  return "Mostly clean sentence punctuation with minimal ornamentation.";
}

function describeCapitalization(samples: string[]) {
  const uppercaseWords = samples.join(" ").match(/\b[A-Z]{3,}\b/g) ?? [];
  if (uppercaseWords.length >= Math.max(3, samples.length * 0.08)) return "Uses occasional all-caps terms for emphasis.";
  return "Mostly standard capitalization.";
}

export function buildCorpusVoiceStats(samples: string[]): CorpusVoiceStats {
  const cleanSamples = samples.map((sample) => sample.trim()).filter(Boolean);
  const lengths = cleanSamples.map(visibleLength);
  const sampleCount = cleanSamples.length;
  const averageTweetLength = sampleCount === 0 ? 0 : Math.round(lengths.reduce((total, length) => total + length, 0) / sampleCount);
  const emojiSampleCount = cleanSamples.filter((sample) => EMOJI_PATTERN.test(sample)).length;
  const lineBreakSampleCount = cleanSamples.filter((sample) => sample.includes("\n")).length;

  return {
    sampleCount,
    averageTweetLength,
    sentenceLength: sentenceLengthFromAverage(averageTweetLength, lengths),
    usesEmojis: emojiSampleCount > 0,
    emojiFrequency: emojiFrequency(emojiSampleCount, sampleCount),
    lineBreakRate: sampleCount === 0 ? 0 : Math.round((lineBreakSampleCount / sampleCount) * 100),
    lineBreakStyle: describeLineBreakStyle(sampleCount === 0 ? 0 : Math.round((lineBreakSampleCount / sampleCount) * 100)),
    punctuationStyle: describePunctuation(cleanSamples),
    capitalizationStyle: describeCapitalization(cleanSamples),
    firstPersonUsage: usageFrequency(cleanSamples.filter((sample) => FIRST_PERSON_PATTERN.test(sample)).length, sampleCount),
    secondPersonUsage: usageFrequency(cleanSamples.filter((sample) => SECOND_PERSON_PATTERN.test(sample)).length, sampleCount),
  };
}

function defaultContextWindowTokens(config: LlmProviderConfig) {
  if (config.provider === "openai-compatible") return DEFAULT_LOW_CONTEXT_WINDOW_TOKENS;
  return DEFAULT_HIGH_CONTEXT_WINDOW_TOKENS;
}

export function getVoiceAnalysisStrategy(config: LlmProviderConfig): VoiceAnalysisStrategy {
  const suppliedTokens = Number(config.contextWindowTokens);
  const contextWindowTokens =
    Number.isFinite(suppliedTokens) && suppliedTokens > 0 ? Math.round(suppliedTokens) : defaultContextWindowTokens(config);
  const mode: VoiceAnalysisMode = contextWindowTokens < HIGH_CONTEXT_ANALYSIS_THRESHOLD_TOKENS ? "chunked" : "direct";
  const directCharBudget = Math.max(4000, Math.min(MAX_DIRECT_ANALYSIS_SAMPLE_CHARS, Math.floor(contextWindowTokens * 1.25)));
  const chunkCharBudget = Math.max(3500, Math.min(MAX_LLM_ANALYSIS_SAMPLE_CHARS, directCharBudget));
  const maxChunks = mode === "chunked" ? (contextWindowTokens >= 8192 ? 2 : 1) : 1;
  const sampleCharBudget =
    mode === "chunked" ? Math.min(MAX_CHUNKED_ANALYSIS_SAMPLE_CHARS, Math.max(chunkCharBudget, chunkCharBudget * maxChunks)) : directCharBudget;

  return {
    mode,
    contextWindowTokens,
    sampleCharBudget,
    chunkCharBudget,
    maxChunks,
  };
}

function stringArray(value: unknown, fallback: string[]) {
  if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean);
  if (typeof value === "string" && value.trim()) return [value.trim()];
  return fallback;
}

function normalizeEnum<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  const lower = String(value ?? "").toLowerCase();
  return allowed.find((option) => lower.includes(option)) ?? fallback;
}

function averageLength(samples: string[]) {
  if (samples.length === 0) return 0;
  return Math.round(samples.reduce((total, sample) => total + sample.length, 0) / samples.length);
}

function normalizeAverageTweetLength(value: unknown, samples: string[], corpusStats?: CorpusVoiceStats) {
  if (corpusStats) return corpusStats.averageTweetLength;
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric >= 20 ? Math.round(numeric) : averageLength(samples);
}

function normalizeToneSliders(value: unknown): VoiceReport["toneSliders"] {
  const source = (value && typeof value === "object" ? value : {}) as Record<string, unknown>;
  const rawValues = TONE_KEYS.map((key) => Number(source[key]));
  const shouldScaleFivePointValues = rawValues.some((raw) => raw > 0) && rawValues.every((raw) => Number.isFinite(raw) && raw <= 5);

  return TONE_KEYS.reduce<VoiceReport["toneSliders"]>((sliders, key, index) => {
    const fallback = DEFAULT_TONE_SLIDERS[key];
    const raw = rawValues[index];
    const value = Number.isFinite(raw) ? raw : fallback;
    sliders[key] = Math.max(0, Math.min(100, Math.round(shouldScaleFivePointValues ? value * 20 : value)));
    return sliders;
  }, { ...DEFAULT_TONE_SLIDERS });
}

export function normalizeVoiceReport(report: unknown, samples: string[], corpusStats?: CorpusVoiceStats): VoiceReport {
  const source = (report && typeof report === "object" ? report : {}) as Record<string, unknown>;
  const mechanics = (source.linguisticMechanics && typeof source.linguisticMechanics === "object" ? source.linguisticMechanics : {}) as Record<
    string,
    unknown
  >;

  return {
    summary: String(source.summary || "Voice analysis generated from the uploaded samples."),
    personalityTraits: stringArray(source.personalityTraits, ["specific", "direct", "Twitter-native"]),
    toneSliders: normalizeToneSliders(source.toneSliders),
    linguisticMechanics: {
      averageTweetLength: normalizeAverageTweetLength(mechanics.averageTweetLength, samples, corpusStats),
      sentenceLength: corpusStats?.sentenceLength ?? normalizeEnum(mechanics.sentenceLength, ["mixed", "short", "medium", "long"], "mixed"),
      usesEmojis: corpusStats?.usesEmojis ?? Boolean(mechanics.usesEmojis),
      emojiFrequency: corpusStats?.emojiFrequency ?? normalizeEnum(mechanics.emojiFrequency, ["none", "low", "medium", "high"], "low"),
      punctuationStyle: corpusStats?.punctuationStyle ?? String(mechanics.punctuationStyle || "Natural punctuation based on the samples."),
      capitalizationStyle: corpusStats?.capitalizationStyle ?? String(mechanics.capitalizationStyle || "Standard capitalization."),
      lineBreakStyle: corpusStats?.lineBreakStyle ?? String(mechanics.lineBreakStyle || "Line breaks follow the uploaded examples."),
      firstPersonUsage: corpusStats?.firstPersonUsage ?? normalizeEnum(mechanics.firstPersonUsage, ["low", "medium", "high"], "low"),
      secondPersonUsage: corpusStats?.secondPersonUsage ?? normalizeEnum(mechanics.secondPersonUsage, ["low", "medium", "high"], "medium"),
    },
    hookPatterns: stringArray(source.hookPatterns, ["Lead with a concrete observation."]),
    endingPatterns: stringArray(source.endingPatterns, ["End with a specific takeaway or light CTA."]),
    preferredPhrases: stringArray(source.preferredPhrases, []),
    avoidedPhrases: stringArray(source.avoidedPhrases, []),
    contentPatterns: Array.isArray(source.contentPatterns)
      ? source.contentPatterns.map((pattern) => {
          const item = (pattern && typeof pattern === "object" ? pattern : {}) as Record<string, unknown>;
          return {
            name: String(item.name || "Sample-backed pattern"),
            description: String(item.description || "A recurring structure from the uploaded tweets."),
            structure: String(item.structure || "Hook, supporting detail, concise ending."),
          };
        })
      : [],
    exampleTweets: stringArray(source.exampleTweets, samples.slice(0, 5)),
  };
}

export function selectAnalysisSamplesForPrompt(samples: SampleInput[], maxChars = MAX_LLM_ANALYSIS_SAMPLE_CHARS) {
  const selected: string[] = [];
  let usedChars = 0;

  for (const sample of samples
    .slice()
    .sort((a, b) => b.qualityScore - a.qualityScore)
    .slice(0, MAX_ANALYSIS_SAMPLES)) {
    const text = sample.cleanedText.trim();
    if (!text) continue;

    const nextLength = usedChars + text.length;
    if (selected.length > 0 && nextLength > maxChars) continue;

    selected.push(selected.length === 0 && text.length > maxChars ? text.slice(0, maxChars).trim() : text);
    usedChars += selected[selected.length - 1].length;
  }

  return selected;
}

export function chunkSamplesForAnalysis(samples: string[], maxChars: number) {
  const chunks: string[][] = [];
  let currentChunk: string[] = [];
  let currentLength = 0;

  for (const sample of samples) {
    const text = sample.trim();
    if (!text) continue;
    const boundedText = text.length > maxChars ? text.slice(0, maxChars).trim() : text;
    const nextLength = currentLength + boundedText.length;

    if (currentChunk.length > 0 && nextLength > maxChars) {
      chunks.push(currentChunk);
      currentChunk = [];
      currentLength = 0;
    }

    currentChunk.push(boundedText);
    currentLength += boundedText.length;
  }

  if (currentChunk.length > 0) chunks.push(currentChunk);
  return chunks;
}

function uniqueStrings(items: string[], limit: number) {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const item of items) {
    const value = item.trim();
    const key = value.toLowerCase();
    if (!value || seen.has(key)) continue;
    seen.add(key);
    result.push(value);
    if (result.length >= limit) break;
  }

  return result;
}

function averageToneSliders(reports: VoiceReport[]): VoiceReport["toneSliders"] {
  if (reports.length === 0) return DEFAULT_TONE_SLIDERS;

  return TONE_KEYS.reduce<VoiceReport["toneSliders"]>((sliders, key) => {
    sliders[key] = Math.round(reports.reduce((total, report) => total + report.toneSliders[key], 0) / reports.length);
    return sliders;
  }, { ...DEFAULT_TONE_SLIDERS });
}

export function mergeVoiceReports(reports: VoiceReport[], samples: string[], corpusStats = buildCorpusVoiceStats(samples)): VoiceReport {
  if (reports.length === 0) return normalizeVoiceReport({}, samples, corpusStats);

  const source = {
    summary: `Merged analysis across ${reports.length} corpus chunk${reports.length === 1 ? "" : "s"}. ${reports
      .slice(0, 3)
      .map((report) => report.summary)
      .join(" ")}`,
    personalityTraits: uniqueStrings(reports.flatMap((report) => report.personalityTraits), 8),
    toneSliders: averageToneSliders(reports),
    linguisticMechanics: reports[0].linguisticMechanics,
    hookPatterns: uniqueStrings(reports.flatMap((report) => report.hookPatterns), 10),
    endingPatterns: uniqueStrings(reports.flatMap((report) => report.endingPatterns), 10),
    preferredPhrases: uniqueStrings(reports.flatMap((report) => report.preferredPhrases), 18),
    avoidedPhrases: uniqueStrings(reports.flatMap((report) => report.avoidedPhrases), 18),
    contentPatterns: reports.flatMap((report) => report.contentPatterns).slice(0, 10),
    exampleTweets: uniqueStrings(reports.flatMap((report) => report.exampleTweets).concat(samples), 10),
  };

  return normalizeVoiceReport(source, samples, corpusStats);
}

export async function analyzeVoice({
  brand,
  samples,
  providerConfig,
}: {
  brand: BrandInput;
  samples: SampleInput[];
  providerConfig: LlmProviderConfig;
}): Promise<VoiceReport> {
  const strategy = getVoiceAnalysisStrategy(providerConfig);
  const corpusSamples = samples.map((sample) => sample.cleanedText);
  const corpusStats = buildCorpusVoiceStats(corpusSamples);
  const corpusProfile = buildCorpusProfile(samples);
  const selected = selectAnalysisSamplesForPrompt(
    samples,
    strategy.sampleCharBudget,
  );

  if (!hasUsableProvider(providerConfig)) {
    throw new Error("A real LLM provider is required. Add a provider key in Settings or .env.local.");
  }

  if (strategy.mode === "chunked") {
    const reports: VoiceReport[] = [];
    const chunks = chunkSamplesForAnalysis(selected, strategy.chunkCharBudget);

    for (const chunk of chunks) {
      const report = await generateJsonWithLlm<VoiceReport>({
        providerConfig,
        prompt: analyzeVoicePrompt({ brandName: brand.name, samples: chunk, corpusStats, corpusProfile, analysisMode: "chunk" }),
        repairJson: false,
      });
      reports.push(normalizeVoiceReport(report, chunk, corpusStats));
    }

    return mergeVoiceReports(reports, selected, corpusStats);
  }

  const report = await generateJsonWithLlm<VoiceReport>({
    providerConfig,
    prompt: analyzeVoicePrompt({ brandName: brand.name, samples: selected, corpusStats, corpusProfile, analysisMode: "direct" }),
  });
  return normalizeVoiceReport(report, selected, corpusStats);
}
