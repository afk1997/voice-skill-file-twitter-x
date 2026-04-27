import type { LlmProviderConfig, ProviderName } from "@/lib/types";

export type ProviderMode = {
  label: "Setup Required" | "Quality" | "Alternate" | "Local Draft";
  description: string;
  isQualityMode: boolean;
  isLocalDraftMode: boolean;
};

export type ProviderModeOptions = {
  serverProvider?: ProviderName;
};

export function defaultModelForProvider(provider?: ProviderName) {
  if (provider === "anthropic") return "claude-sonnet-4-6";
  if (provider === "openai") return "gpt-5.4";
  if (provider === "openrouter") return "anthropic/claude-sonnet-4.6";
  if (provider === "openai-compatible") return "";
  return "claude-sonnet-4-6";
}

export function isLocalBaseUrl(baseUrl?: string) {
  return Boolean(baseUrl && /localhost|127\.0\.0\.1|0\.0\.0\.0/i.test(baseUrl));
}

export function providerModeForConfig(config: LlmProviderConfig, options: ProviderModeOptions = {}): ProviderMode {
  const hasBrowserKey = Boolean(config.apiKey);
  const hasLocalEndpoint = Boolean(config.provider === "openai-compatible" && config.baseUrl);
  const usesServerProvider = Boolean(options.serverProvider && !hasBrowserKey && !hasLocalEndpoint);

  if (usesServerProvider) {
    if (options.serverProvider === "anthropic") {
      return {
        label: "Quality",
        description: "Claude quality mode from the server environment.",
        isQualityMode: true,
        isLocalDraftMode: false,
      };
    }

    if (options.serverProvider === "openai") {
      return {
        label: "Quality",
        description: "OpenAI quality mode from the server environment.",
        isQualityMode: true,
        isLocalDraftMode: false,
      };
    }

    return {
      label: "Alternate",
      description: "Server environment provider is configured. Quality depends on the selected model.",
      isQualityMode: false,
      isLocalDraftMode: false,
    };
  }

  if (!config.provider || !config.apiKey) {
    return {
      label: "Setup Required",
      description: "Add a real provider key in Settings, or use .env.local and leave browser settings empty.",
      isQualityMode: false,
      isLocalDraftMode: false,
    };
  }

  if (config.provider === "anthropic") {
    return {
      label: "Quality",
      description: "Claude quality mode for voice analysis, generation, and evaluation.",
      isQualityMode: true,
      isLocalDraftMode: false,
    };
  }

  if (config.provider === "openai-compatible" && isLocalBaseUrl(config.baseUrl)) {
    return {
      label: "Local Draft",
      description: "Local draft mode. Useful for privacy and smoke tests, not final voice quality.",
      isQualityMode: false,
      isLocalDraftMode: true,
    };
  }

  return {
    label: "Alternate",
    description: "Alternate BYOK provider mode. Quality depends on the selected model.",
    isQualityMode: false,
    isLocalDraftMode: false,
  };
}

export function candidatePoolSize(requested: number) {
  const count = Math.max(1, Math.min(10, Math.round(requested)));
  if (count <= 3) return 8;
  if (count <= 6) return 12;
  return 16;
}
