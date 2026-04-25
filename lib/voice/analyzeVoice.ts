import { MAX_ANALYSIS_SAMPLES, MAX_LLM_ANALYSIS_SAMPLE_CHARS } from "@/lib/constants";
import { generateJsonWithLlm, hasUsableProvider } from "@/lib/llm/client";
import { mockVoiceReport } from "@/lib/llm/mockProvider";
import { analyzeVoicePrompt } from "@/lib/llm/prompts/analyzeVoicePrompt";
import type { LlmProviderConfig, VoiceReport } from "@/lib/types";

type BrandInput = {
  name: string;
  audience?: string | null;
  beliefs?: string | null;
};

type SampleInput = {
  cleanedText: string;
  qualityScore: number;
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

function normalizeAverageTweetLength(value: unknown, samples: string[]) {
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

export function normalizeVoiceReport(report: unknown, samples: string[]): VoiceReport {
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
      averageTweetLength: normalizeAverageTweetLength(mechanics.averageTweetLength, samples),
      sentenceLength: normalizeEnum(mechanics.sentenceLength, ["mixed", "short", "medium", "long"], "mixed"),
      usesEmojis: Boolean(mechanics.usesEmojis),
      emojiFrequency: normalizeEnum(mechanics.emojiFrequency, ["none", "low", "medium", "high"], "low"),
      punctuationStyle: String(mechanics.punctuationStyle || "Natural punctuation based on the samples."),
      capitalizationStyle: String(mechanics.capitalizationStyle || "Standard capitalization."),
      lineBreakStyle: String(mechanics.lineBreakStyle || "Line breaks follow the uploaded examples."),
      firstPersonUsage: normalizeEnum(mechanics.firstPersonUsage, ["low", "medium", "high"], "low"),
      secondPersonUsage: normalizeEnum(mechanics.secondPersonUsage, ["low", "medium", "high"], "medium"),
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

export async function analyzeVoice({
  brand,
  samples,
  providerConfig,
}: {
  brand: BrandInput;
  samples: SampleInput[];
  providerConfig: LlmProviderConfig;
}): Promise<VoiceReport> {
  const selected = selectAnalysisSamplesForPrompt(samples);

  if (hasUsableProvider(providerConfig)) {
    const report = await generateJsonWithLlm<VoiceReport>({
      providerConfig,
      prompt: analyzeVoicePrompt({ brandName: brand.name, samples: selected }),
    });
    return normalizeVoiceReport(report, selected);
  }

  return normalizeVoiceReport(mockVoiceReport({ brandName: brand.name, samples: selected }), selected);
}
