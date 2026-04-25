import type { LlmProviderConfig } from "@/lib/types";

type GenerateJsonInput = {
  providerConfig: LlmProviderConfig;
  prompt: string;
};

function envKey(provider?: string) {
  if (provider === "anthropic") return process.env.ANTHROPIC_API_KEY;
  if (provider === "openai") return process.env.OPENAI_API_KEY;
  if (provider === "openrouter") return process.env.OPENROUTER_API_KEY;
  if (provider === "openai-compatible") return process.env.OPENAI_COMPATIBLE_API_KEY;
  return undefined;
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
  return Boolean(config.apiKey || envKey(config.provider));
}

export async function generateJsonWithLlm<T>({ providerConfig, prompt }: GenerateJsonInput): Promise<T> {
  const provider = providerConfig.provider ?? "mock";
  const apiKey = providerConfig.apiKey || envKey(provider);
  if (!apiKey || provider === "mock") {
    throw new Error("No usable LLM provider configured.");
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
        model: providerConfig.model || "claude-3-5-sonnet-latest",
        max_tokens: 3000,
        messages: [{ role: "user", content: prompt }],
      }),
    });
    if (!response.ok) throw new Error(`Anthropic error ${response.status}: ${await response.text()}`);
    const json = await response.json();
    const text = json.content?.[0]?.text;
    if (!text) throw new Error("Anthropic returned no text content.");
    return parseJsonFromModel<T>(text);
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
    model: providerConfig.model || (provider === "openrouter" ? "anthropic/claude-3.5-sonnet" : "gpt-4o-mini"),
    messages: [{ role: "user", content: prompt }],
  };

  if (provider !== "openai-compatible") {
    requestBody.response_format = { type: "json_object" };
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
  return parseJsonFromModel<T>(text);
}
