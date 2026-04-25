"use client";

import { useEffect, useState } from "react";
import { defaultModelForProvider, providerModeForConfig } from "@/lib/llm/providerMode";
import type { LlmProviderConfig, ProviderName } from "@/lib/types";

export const PROVIDER_STORAGE_KEY = "voice-skill-file-provider-config";

const PROVIDERS: { value: ProviderName; label: string }[] = [
  { value: "mock", label: "Mock provider" },
  { value: "anthropic", label: "Anthropic" },
  { value: "openai", label: "OpenAI" },
  { value: "openrouter", label: "OpenRouter" },
  { value: "openai-compatible", label: "OpenAI-compatible" },
];

const DEFAULT_CONFIG: LlmProviderConfig = {
  provider: "mock",
  model: "",
  baseUrl: "",
  apiKey: "",
  contextWindowTokens: undefined,
};

export function readStoredProviderConfig(): LlmProviderConfig {
  if (typeof window === "undefined") return {};
  const raw = window.localStorage.getItem(PROVIDER_STORAGE_KEY);
  if (!raw) return {};
  try {
    return JSON.parse(raw) as LlmProviderConfig;
  } catch {
    return {};
  }
}

export function ProviderSettingsForm() {
  const [config, setConfig] = useState<LlmProviderConfig>(DEFAULT_CONFIG);
  const [saved, setSaved] = useState(false);
  const mode = providerModeForConfig(config);

  useEffect(() => {
    setConfig({ ...DEFAULT_CONFIG, ...readStoredProviderConfig() });
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
    <form onSubmit={onSubmit} className="max-w-2xl space-y-5 rounded-ui border border-line bg-white p-5">
      <label className="block space-y-1">
        <span className="text-sm font-medium text-ink">Provider</span>
        <select
          value={config.provider || "mock"}
          onChange={(event) => update("provider", event.target.value as ProviderName)}
          className="w-full rounded-ui border border-line px-3 py-2 text-sm"
        >
          {PROVIDERS.map((provider) => (
            <option key={provider.value} value={provider.value}>
              {provider.label}
            </option>
          ))}
        </select>
        <span className="inline-flex rounded-ui border border-line bg-surface px-2 py-1 text-xs font-medium text-muted">
          {mode.label}: {mode.description}
        </span>
      </label>

      <label className="block space-y-1">
        <span className="text-sm font-medium text-ink">Model</span>
        <input
          value={config.model || ""}
          onChange={(event) => update("model", event.target.value)}
          className="w-full rounded-ui border border-line px-3 py-2 text-sm"
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
          className="w-full rounded-ui border border-line px-3 py-2 text-sm"
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
          className="w-full rounded-ui border border-line px-3 py-2 text-sm"
          placeholder="Optional. LM Studio default is often 4096."
        />
        <span className="text-xs text-muted">Leave blank for auto. Use the context size you loaded in your local model settings.</span>
      </label>

      <label className="block space-y-1">
        <span className="text-sm font-medium text-ink">API key</span>
        <input
          type="password"
          value={config.apiKey || ""}
          onChange={(event) => update("apiKey", event.target.value)}
          className="w-full rounded-ui border border-line px-3 py-2 text-sm"
          placeholder="Stored only in this browser"
        />
      </label>

      <div className="flex items-center gap-3">
        <button type="submit" className="rounded-ui bg-ink px-4 py-2 text-sm font-medium text-white">
          Save local settings
        </button>
        {saved ? <span className="text-sm text-good">Saved in localStorage.</span> : null}
      </div>
    </form>
  );
}
