"use client";

import { useEffect, useState } from "react";
import { readApiJson } from "@/lib/http/readApiJson";
import { defaultModelForProvider, providerModeForConfig } from "@/lib/llm/providerMode";
import type { LlmProviderConfig, ProviderName } from "@/lib/types";

export const PROVIDER_STORAGE_KEY = "voice-skill-file-provider-config";

const PROVIDERS: { value: ProviderName; label: string }[] = [
  { value: "anthropic", label: "Anthropic" },
  { value: "openai", label: "OpenAI" },
  { value: "openrouter", label: "OpenRouter" },
  { value: "openai-compatible", label: "OpenAI-compatible" },
  { value: "codex-local", label: "Codex Local" },
];

const DEFAULT_CONFIG: LlmProviderConfig = {
  provider: "anthropic",
  model: "",
  embeddingModel: "",
  baseUrl: "",
  apiKey: "",
  contextWindowTokens: undefined,
};

function normalizeProviderConfig(value: LlmProviderConfig): LlmProviderConfig {
  const provider = PROVIDERS.some((option) => option.value === value.provider) ? value.provider : DEFAULT_CONFIG.provider;
  return { ...value, provider };
}

export function readStoredProviderConfig(): LlmProviderConfig {
  if (typeof window === "undefined") return {};
  const raw = window.localStorage.getItem(PROVIDER_STORAGE_KEY);
  if (!raw) return {};
  try {
    return normalizeProviderConfig(JSON.parse(raw) as LlmProviderConfig);
  } catch {
    return {};
  }
}

export function ProviderSettingsForm() {
  const [config, setConfig] = useState<LlmProviderConfig>(DEFAULT_CONFIG);
  const [serverProvider, setServerProvider] = useState<ProviderName | undefined>();
  const [saved, setSaved] = useState(false);
  const mode = providerModeForConfig(config, { serverProvider });

  useEffect(() => {
    setConfig({ ...DEFAULT_CONFIG, ...readStoredProviderConfig() });
    fetch("/api/provider-status")
      .then((response) => readApiJson<{ error?: string; provider?: ProviderName }>(response))
      .then((status) => setServerProvider(status.provider))
      .catch(() => setServerProvider(undefined));
  }, []);

  function update<K extends keyof LlmProviderConfig>(key: K, value: LlmProviderConfig[K]) {
    setConfig((current) => ({ ...current, [key]: value }));
    setSaved(false);
  }

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    window.localStorage.setItem(PROVIDER_STORAGE_KEY, JSON.stringify(config));
    setSaved(true);
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5 spool-plate p-5">
      <label className="block space-y-1">
        <span className="text-sm font-medium text-ink">Provider</span>
        <select
          value={config.provider || "anthropic"}
          onChange={(event) => update("provider", event.target.value as ProviderName)}
          className="w-full spool-field px-3 py-2 text-sm"
        >
          {PROVIDERS.map((provider) => (
            <option key={provider.value} value={provider.value}>
              {provider.label}
            </option>
          ))}
        </select>
        <span className="spool-stamp mt-2">
          {mode.label}: {mode.description}
        </span>
      </label>

      <label className="block space-y-1">
        <span className="text-sm font-medium text-ink">Model</span>
        <input
          value={config.model || ""}
          onChange={(event) => update("model", event.target.value)}
          className="w-full spool-field px-3 py-2 text-sm"
          placeholder={defaultModelForProvider(config.provider) || "Required for OpenAI-compatible local providers"}
        />
        {config.provider === "anthropic" ? (
          <span className="text-xs text-muted">Recommended quality model: claude-sonnet-4-6.</span>
        ) : null}
      </label>

      <label className="block space-y-1">
        <span className="text-sm font-medium text-ink">Base URL</span>
        <input
          value={config.baseUrl || ""}
          onChange={(event) => update("baseUrl", event.target.value)}
          className="w-full spool-field px-3 py-2 text-sm"
          placeholder="Only required for OpenAI-compatible providers"
        />
      </label>

      <label className="block space-y-1">
        <span className="text-sm font-medium text-ink">Context window tokens</span>
        <input
          type="number"
          min={1024}
          step={1024}
          value={config.contextWindowTokens || ""}
          onChange={(event) => update("contextWindowTokens", event.target.value ? Number(event.target.value) : undefined)}
          className="w-full spool-field px-3 py-2 text-sm"
          placeholder="Optional. LM Studio default is often 4096."
        />
        <span className="text-xs text-muted">Leave blank for auto. Use the context size you loaded in your local model settings.</span>
      </label>

      <label className="block space-y-1">
        <span className="text-sm font-medium text-ink">Embedding model</span>
        <input
          value={config.embeddingModel || ""}
          onChange={(event) => update("embeddingModel", event.target.value)}
          className="w-full spool-field px-3 py-2 text-sm"
          placeholder="Optional. Defaults to text-embedding-3-small."
        />
        <span className="text-xs text-muted">Used for hybrid semantic retrieval when OpenAI or OpenAI-compatible embeddings are available.</span>
      </label>

      <label className="block space-y-1">
        <span className="text-sm font-medium text-ink">API key</span>
        <input
          type="password"
          value={config.apiKey || ""}
          onChange={(event) => update("apiKey", event.target.value)}
          className="w-full spool-field px-3 py-2 text-sm"
          placeholder="Stored only in this browser"
        />
      </label>

      <div className="flex items-center gap-3">
        <button type="submit" className="spool-button">
          Save local settings
        </button>
        {saved ? <span className="text-sm text-good">Saved in localStorage.</span> : null}
      </div>
    </form>
  );
}
