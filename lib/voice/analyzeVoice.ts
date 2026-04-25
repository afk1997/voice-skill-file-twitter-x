import { MAX_ANALYSIS_SAMPLES } from "@/lib/constants";
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

export async function analyzeVoice({
  brand,
  samples,
  providerConfig,
}: {
  brand: BrandInput;
  samples: SampleInput[];
  providerConfig: LlmProviderConfig;
}): Promise<VoiceReport> {
  const selected = samples
    .slice()
    .sort((a, b) => b.qualityScore - a.qualityScore)
    .slice(0, MAX_ANALYSIS_SAMPLES)
    .map((sample) => sample.cleanedText);

  if (hasUsableProvider(providerConfig)) {
    return generateJsonWithLlm<VoiceReport>({
      providerConfig,
      prompt: analyzeVoicePrompt({ brandName: brand.name, samples: selected }),
    });
  }

  return mockVoiceReport({ brandName: brand.name, samples: selected });
}
