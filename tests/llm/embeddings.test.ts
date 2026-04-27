import { afterEach, describe, expect, it, vi } from "vitest";
import { generateEmbeddingsWithLlm, hasUsableEmbeddingProvider } from "@/lib/llm/embeddings";

describe("LLM embeddings client", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("requests OpenAI-compatible embeddings for multiple texts", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        data: [
          { index: 0, embedding: [1, 0, 0] },
          { index: 1, embedding: [0, 1, 0] },
        ],
      }),
    }));
    vi.stubGlobal("fetch", fetchMock);

    const vectors = await generateEmbeddingsWithLlm({
      providerConfig: { provider: "openai", apiKey: "key" },
      input: ["semantic topic", "voice example"],
    });

    expect(vectors).toEqual([
      [1, 0, 0],
      [0, 1, 0],
    ]);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.openai.com/v1/embeddings",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ authorization: "Bearer key" }),
        body: JSON.stringify({
          model: "text-embedding-3-small",
          input: ["semantic topic", "voice example"],
          encoding_format: "float",
        }),
      }),
    );
  });

  it("reports embedding availability only for embedding-capable provider config", () => {
    expect(hasUsableEmbeddingProvider({ provider: "openai", apiKey: "key" })).toBe(true);
    expect(hasUsableEmbeddingProvider({ provider: "openai-compatible", apiKey: "key", baseUrl: "http://localhost:1234/v1" })).toBe(true);
    expect(hasUsableEmbeddingProvider({ provider: "anthropic", apiKey: "key" })).toBe(false);
  });
});
