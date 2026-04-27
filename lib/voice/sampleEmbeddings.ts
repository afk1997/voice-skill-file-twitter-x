import { createHash } from "crypto";
import type { LlmProviderConfig } from "@/lib/types";
import { embeddingModelForConfig, generateEmbeddingsWithLlm, hasUsableEmbeddingProvider } from "@/lib/llm/embeddings";

export type RetrievalMode = "hybrid" | "voice-only";

export type EmbeddableSample = {
  id: string;
  cleanedText: string;
  qualityScore: number;
  classification?: string | null;
  embeddingJson?: string | null;
  embeddingHash?: string | null;
  embeddingModel?: string | null;
  embedding?: number[];
};

export type StoredEmbedding = {
  embedding: number[];
  embeddingJson: string;
  embeddingHash: string;
  embeddingModel: string;
  embeddedAt: Date;
};

export function hashEmbeddingInput(text: string) {
  return createHash("sha256").update(text.trim()).digest("hex");
}

function parseEmbedding(value?: string | null) {
  if (!value) return undefined;
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) && parsed.every((item) => typeof item === "number") ? parsed : undefined;
  } catch {
    return undefined;
  }
}

export async function ensureSampleEmbeddings({
  providerConfig,
  samples,
  embedTexts = (texts) => generateEmbeddingsWithLlm({ providerConfig, input: texts }),
  saveEmbedding,
  maxNewEmbeddings = 500,
}: {
  providerConfig: LlmProviderConfig;
  samples: EmbeddableSample[];
  embedTexts?: (texts: string[]) => Promise<number[][]>;
  saveEmbedding: (sampleId: string, embedding: StoredEmbedding) => Promise<void>;
  maxNewEmbeddings?: number;
}): Promise<{ mode: RetrievalMode; samples: EmbeddableSample[]; error?: string }> {
  if (!hasUsableEmbeddingProvider(providerConfig)) {
    return { mode: "voice-only", samples };
  }

  const model = embeddingModelForConfig(providerConfig);
  const nextSamples: EmbeddableSample[] = samples.map((sample) => {
    const textHash = hashEmbeddingInput(sample.cleanedText);
    const existing = sample.embeddingModel === model && sample.embeddingHash === textHash ? parseEmbedding(sample.embeddingJson) : undefined;
    return existing ? { ...sample, embedding: existing } : { ...sample, embedding: undefined };
  });

  const missing = nextSamples
    .filter((sample) => !sample.embedding)
    .slice(0, maxNewEmbeddings);

  if (missing.length === 0) {
    return { mode: nextSamples.some((sample) => sample.embedding) ? "hybrid" : "voice-only", samples: nextSamples };
  }

  try {
    const vectors = await embedTexts(missing.map((sample) => sample.cleanedText));
    await Promise.all(
      missing.map(async (sample, index) => {
        const embedding = vectors[index];
        if (!embedding) return;
        const stored: StoredEmbedding = {
          embedding,
          embeddingJson: JSON.stringify(embedding),
          embeddingHash: hashEmbeddingInput(sample.cleanedText),
          embeddingModel: model,
          embeddedAt: new Date(),
        };
        sample.embedding = embedding;
        sample.embeddingJson = stored.embeddingJson;
        sample.embeddingHash = stored.embeddingHash;
        sample.embeddingModel = stored.embeddingModel;
        await saveEmbedding(sample.id, stored);
      }),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Embedding backfill failed.";
    return { mode: "voice-only", samples, error: message };
  }

  return { mode: nextSamples.some((sample) => sample.embedding) ? "hybrid" : "voice-only", samples: nextSamples };
}
