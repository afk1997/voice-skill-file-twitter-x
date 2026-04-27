import type { LlmProviderConfig, ProviderName } from "@/lib/types";
import { defaultModelForProvider } from "@/lib/llm/providerMode";

type GenerateJsonInput = {
  providerConfig: LlmProviderConfig;
  prompt: string;
  repairJson?: boolean;
};

type GenerateTextInput = GenerateJsonInput & {
  preferJsonSchema?: boolean;
};

function envKey(provider?: string) {
  if (provider === "anthropic") return process.env.ANTHROPIC_API_KEY;
  if (provider === "openai") return process.env.OPENAI_API_KEY;
  if (provider === "openrouter") return process.env.OPENROUTER_API_KEY;
  if (provider === "openai-compatible") return process.env.OPENAI_COMPATIBLE_API_KEY;
  return undefined;
}

export function providerFromEnv(): ProviderName | undefined {
  if (process.env.ANTHROPIC_API_KEY) return "anthropic";
  if (process.env.OPENAI_API_KEY) return "openai";
  if (process.env.OPENROUTER_API_KEY) return "openrouter";
  if (process.env.OPENAI_COMPATIBLE_API_KEY) return "openai-compatible";
  return undefined;
}

function resolveProvider(config: LlmProviderConfig): ProviderName | undefined {
  if (
    config.provider === "anthropic" ||
    config.provider === "openai" ||
    config.provider === "openrouter" ||
    config.provider === "openai-compatible"
  ) {
    if (!config.apiKey && !envKey(config.provider) && !config.baseUrl) {
      return providerFromEnv() ?? config.provider;
    }
    return config.provider;
  }

  return providerFromEnv();
}

function parseJsonFromModel<T>(text: string): T {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1].trim() : trimmed;

  try {
    return JSON.parse(candidate) as T;
  } catch (error) {
    const objectStart = candidate.indexOf("{");
    const objectEnd = candidate.lastIndexOf("}");
    const arrayStart = candidate.indexOf("[");
    const arrayEnd = candidate.lastIndexOf("]");
    const extracted =
      objectStart > -1 && objectEnd > objectStart
        ? candidate.slice(objectStart, objectEnd + 1)
        : arrayStart > -1 && arrayEnd > arrayStart
          ? candidate.slice(arrayStart, arrayEnd + 1)
          : "";

    if (extracted) return JSON.parse(extracted) as T;
    throw error;
  }
}

export function hasUsableProvider(config: LlmProviderConfig) {
  const provider = resolveProvider(config);
  return Boolean(provider && (config.apiKey || envKey(provider)));
}

async function generateTextWithLlm({ providerConfig, prompt, preferJsonSchema = false }: GenerateTextInput) {
  const provider = resolveProvider(providerConfig);
  const apiKey = providerConfig.apiKey || envKey(provider);
  if (!provider || !apiKey) {
    throw new Error("A real LLM provider is required. Add a provider key in Settings or .env.local.");
  }

  if (provider === "anthropic") {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: providerConfig.model || defaultModelForProvider(provider),
        max_tokens: 3000,
        messages: [{ role: "user", content: prompt }],
      }),
    });
    if (!response.ok) throw new Error(`Anthropic error ${response.status}: ${await response.text()}`);
    const json = await response.json();
    const text = json.content?.[0]?.text;
    if (!text) throw new Error("Anthropic returned no text content.");
    return text as string;
  }

  const baseUrl =
    provider === "openrouter"
      ? "https://openrouter.ai/api/v1"
      : provider === "openai-compatible"
        ? providerConfig.baseUrl || process.env.OPENAI_COMPATIBLE_BASE_URL
        : "https://api.openai.com/v1";

  if (!baseUrl) {
    throw new Error("OpenAI-compatible provider requires a base URL.");
  }

  const requestBody: Record<string, unknown> = {
    model: providerConfig.model || defaultModelForProvider(provider),
    messages: [{ role: "user", content: prompt }],
  };

  if (provider !== "openai-compatible") {
    requestBody.response_format = { type: "json_object" };
  } else if (preferJsonSchema) {
    requestBody.response_format = {
      type: "json_schema",
      json_schema: {
        name: "json_response",
        schema: { type: "object" },
        strict: false,
      },
    };
  }

  const response = await fetch(`${baseUrl.replace(/\/$/, "")}/chat/completions`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(requestBody),
  });
  if (!response.ok) throw new Error(`${provider} error ${response.status}: ${await response.text()}`);
  const json = await response.json();
  const text = json.choices?.[0]?.message?.content;
  if (!text) throw new Error(`${provider} returned no message content.`);
  return text as string;
}

async function repairJsonWithLlm({
  providerConfig,
  invalidJson,
  errorMessage,
}: {
  providerConfig: LlmProviderConfig;
  invalidJson: string;
  errorMessage: string;
}) {
  return generateTextWithLlm({
    providerConfig,
    preferJsonSchema: true,
    prompt: `Repair this invalid JSON so it can be parsed by JSON.parse.

Return only valid JSON. Do not include markdown, comments, or explanation.
Preserve the same object shape and values. Do not invent new fields.

Parser error:
${errorMessage}

Invalid JSON:
${invalidJson.slice(0, 12000)}`,
  });
}

export async function generateJsonWithLlm<T>({ providerConfig, prompt, repairJson = true }: GenerateJsonInput): Promise<T> {
  const text = await generateTextWithLlm({ providerConfig, prompt });

  try {
    return parseJsonFromModel<T>(text);
  } catch (error) {
    if (!repairJson) throw error;
    const errorMessage = error instanceof Error ? error.message : "Invalid JSON returned by model.";
    const repairedText = await repairJsonWithLlm({ providerConfig, invalidJson: text, errorMessage });
    return parseJsonFromModel<T>(repairedText);
  }
}
