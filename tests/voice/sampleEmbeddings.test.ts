import { describe, expect, it } from "vitest";
import { ensureSampleEmbeddings, hashEmbeddingInput } from "@/lib/voice/sampleEmbeddings";

describe("sample embedding persistence", () => {
  it("embeds only missing or stale samples and returns hybrid-ready samples", async () => {
    const currentHash = hashEmbeddingInput("already embedded");
    const updates: Array<{ id: string; embeddingJson: string; embeddingHash: string }> = [];

    const result = await ensureSampleEmbeddings({
      providerConfig: { provider: "openai", apiKey: "key" },
      samples: [
        {
          id: "current",
          cleanedText: "already embedded",
          qualityScore: 90,
          embeddingJson: "[1,0]",
          embeddingHash: currentHash,
          embeddingModel: "text-embedding-3-small",
        },
        {
          id: "missing",
          cleanedText: "needs semantic vector",
          qualityScore: 85,
          embeddingJson: null,
          embeddingHash: null,
          embeddingModel: null,
        },
        {
          id: "stale",
          cleanedText: "changed text",
          qualityScore: 80,
          embeddingJson: "[0,1]",
          embeddingHash: "old-hash",
          embeddingModel: "text-embedding-3-small",
        },
      ],
      embedTexts: async (texts) => texts.map((text) => (text.includes("needs") ? [0.8, 0.2] : [0.4, 0.6])),
      saveEmbedding: async (sampleId, embedding) => {
        updates.push({ id: sampleId, embeddingJson: embedding.embeddingJson, embeddingHash: embedding.embeddingHash });
      },
    });

    expect(result.mode).toBe("hybrid");
    expect(result.samples.map((sample) => sample.embedding)).toEqual([
      [1, 0],
      [0.8, 0.2],
      [0.4, 0.6],
    ]);
    expect(updates.map((update) => update.id)).toEqual(["missing", "stale"]);
    expect(updates[0].embeddingHash).toBe(hashEmbeddingInput("needs semantic vector"));
  });

  it("falls back to voice-only samples when no embedding provider is configured", async () => {
    const result = await ensureSampleEmbeddings({
      providerConfig: { provider: "anthropic", apiKey: "key" },
      samples: [{ id: "sample", cleanedText: "plain sample", qualityScore: 90 }],
      embedTexts: async () => {
        throw new Error("should not embed");
      },
      saveEmbedding: async () => {
        throw new Error("should not save");
      },
    });

    expect(result.mode).toBe("voice-only");
    expect(result.samples[0].embedding).toBeUndefined();
  });
});
