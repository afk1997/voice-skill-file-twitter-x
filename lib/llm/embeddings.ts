import type { LlmProviderConfig, ProviderName } from "@/lib/types";

export const DEFAULT_EMBEDDING_MODEL = "text-embedding-3-small";

type EmbeddingResponseItem = {
  index?: number;
  embedding?: unknown;
};

function envKey(provider?: ProviderName) {
  if (provider === "openai") return process.env.OPENAI_API_KEY;
  if (provider === "openai-compatible") return process.env.OPENAI_COMPATIBLE_API_KEY;
  return undefined;
}

function embeddingProviderFromEnv(): ProviderName | undefined {
  if (process.env.OPENAI_API_KEY) return "openai";
  if (process.env.OPENAI_COMPATIBLE_API_KEY) return "openai-compatible";
  return undefined;
}

function resolveEmbeddingProvider(config: LlmProviderConfig): ProviderName | undefined {
  if (config.provider === "openai" || config.provider === "openai-compatible") return config.provider;
  return embeddingProviderFromEnv();
}

function embeddingApiKey(config: LlmProviderConfig) {
  const provider = resolveEmbeddingProvider(config);
  return config.apiKey && (config.provider === "openai" || config.provider === "openai-compatible")
    ? config.apiKey
    : envKey(provider);
}

export function embeddingModelForConfig(config: LlmProviderConfig) {
  return config.embeddingModel || process.env.OPENAI_EMBEDDING_MODEL || process.env.EMBEDDING_MODEL || DEFAULT_EMBEDDING_MODEL;
}

export function hasUsableEmbeddingProvider(config: LlmProviderConfig) {
  const provider = resolveEmbeddingProvider(config);
  return Boolean(provider && embeddingApiKey(config));
}

function embeddingBaseUrl(config: LlmProviderConfig, provider: ProviderName) {
  if (provider === "openai-compatible") return config.baseUrl || process.env.OPENAI_COMPATIBLE_BASE_URL;
  return "https://api.openai.com/v1";
}

export async function generateEmbeddingsWithLlm({
  providerConfig,
  input,
}: {
  providerConfig: LlmProviderConfig;
  input: string[];
}): Promise<number[][]> {
  const texts = input.map((text) => text.trim()).filter(Boolean);
  if (texts.length === 0) return [];

  const provider = resolveEmbeddingProvider(providerConfig);
  const apiKey = embeddingApiKey(providerConfig);
  if (!provider || !apiKey) {
    throw new Error("OpenAI or OpenAI-compatible embeddings are required for semantic retrieval.");
  }

  const baseUrl = embeddingBaseUrl(providerConfig, provider);
  if (!baseUrl) {
    throw new Error("OpenAI-compatible embeddings require a base URL.");
  }

  const response = await fetch(`${baseUrl.replace(/\/$/, "")}/embeddings`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: embeddingModelForConfig(providerConfig),
      input: texts,
      encoding_format: "float",
    }),
  });

  if (!response.ok) throw new Error(`Embedding provider error ${response.status}: ${await response.text()}`);
  const json = await response.json();
  const data: EmbeddingResponseItem[] = Array.isArray(json.data) ? json.data : [];
  const ordered = data
    .slice()
    .sort((a, b) => Number(a.index ?? 0) - Number(b.index ?? 0))
    .map((item) => item.embedding)
    .filter((embedding) => Array.isArray(embedding) && embedding.every((value) => typeof value === "number"));

  if (ordered.length !== texts.length) {
    throw new Error("Embedding provider returned an unexpected vector count.");
  }

  return ordered;
}
