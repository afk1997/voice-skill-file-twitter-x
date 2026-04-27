import { generateEmbeddingsWithLlm } from "@/lib/llm/embeddings";
import type { LlmProviderConfig, VoiceSkillFile } from "@/lib/types";
import { type EmbeddableSample, ensureSampleEmbeddings, type StoredEmbedding } from "@/lib/voice/sampleEmbeddings";
import { selectExamplesForGeneration } from "@/lib/voice/selectExamples";

export async function selectHybridExamplesForGeneration({
  context,
  tweetType,
  notes,
  skillFile,
  samples,
  limit,
  providerConfig,
  saveEmbedding,
}: {
  context: string;
  tweetType: string;
  notes?: string;
  skillFile: VoiceSkillFile;
  samples: EmbeddableSample[];
  limit: number;
  providerConfig: LlmProviderConfig;
  saveEmbedding: (sampleId: string, embedding: StoredEmbedding) => Promise<void>;
}) {
  const embedded = await ensureSampleEmbeddings({
    providerConfig,
    samples,
    saveEmbedding,
  });

  let contextEmbedding: number[] | undefined;
  const requestContext = [context, notes].filter(Boolean).join("\n");
  if (embedded.mode === "hybrid") {
    try {
      [contextEmbedding] = await generateEmbeddingsWithLlm({ providerConfig, input: [requestContext] });
    } catch {
      contextEmbedding = undefined;
    }
  }

  return selectExamplesForGeneration({
    context,
    tweetType,
    notes,
    skillFile,
    samples: embedded.samples,
    limit,
    contextEmbedding,
  });
}
