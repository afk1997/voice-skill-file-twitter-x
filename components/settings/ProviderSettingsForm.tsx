"use client";

import { useEffect, useState } from "react";
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
      </label>

      <label className="block space-y-1">
        <span className="text-sm font-medium text-ink">Model</span>
        <input
          value={config.model || ""}
          onChange={(event) => update("model", event.target.value)}
          className="w-full rounded-ui border border-line px-3 py-2 text-sm"
          placeholder="claude-3-5-sonnet-latest, gpt-4o-mini, openrouter model..."
        />
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
