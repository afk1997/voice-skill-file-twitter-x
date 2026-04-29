import { describe, expect, it } from "vitest";
import { candidatePoolSize, defaultModelForProvider, providerModeForConfig } from "@/lib/llm/providerMode";

describe("providerMode", () => {
  it("defaults to a setup-required state instead of placeholder mode", () => {
    expect(defaultModelForProvider()).toBe("claude-sonnet-4-6");
    expect(providerModeForConfig({})).toMatchObject({
      label: "Setup Required",
      isQualityMode: false,
      isLocalDraftMode: false,
    });
  });

  it("uses Claude Sonnet 4.6 as the Anthropic quality default", () => {
    expect(defaultModelForProvider("anthropic")).toBe("claude-sonnet-4-6");
    expect(providerModeForConfig({ provider: "anthropic", apiKey: "key" })).toEqual({
      label: "Quality",
      description: "Claude quality mode for voice analysis, generation, and evaluation.",
      isQualityMode: true,
      isLocalDraftMode: false,
    });
  });

  it("does not call a selected provider ready until a browser key is present", () => {
    expect(providerModeForConfig({ provider: "anthropic" })).toMatchObject({
      label: "Setup Required",
      isQualityMode: false,
    });
  });

  it("shows server env providers as real quality mode without exposing the key", () => {
    expect(providerModeForConfig({}, { serverProvider: "openai" })).toEqual({
      label: "Quality",
      description: "OpenAI quality mode from the server environment.",
      isQualityMode: true,
      isLocalDraftMode: false,
    });
    expect(providerModeForConfig({ provider: "openai" }, { serverProvider: "openai" })).toMatchObject({
      label: "Quality",
      isQualityMode: true,
    });
    expect(providerModeForConfig({ provider: "anthropic" }, { serverProvider: "openai" })).toMatchObject({
      label: "Quality",
      description: "OpenAI quality mode from the server environment.",
      isQualityMode: true,
    });
  });

  it("labels OpenAI-compatible local endpoints as local draft mode", () => {
    expect(
      providerModeForConfig({
        provider: "openai-compatible",
        baseUrl: "http://localhost:1234/v1",
        apiKey: "key",
        model: "google/gemma-4-e2b",
      }),
    ).toMatchObject({
      label: "Local Draft",
      isQualityMode: false,
      isLocalDraftMode: true,
    });
  });

  it("labels Codex Local as a local provider without a browser API key", () => {
    expect(defaultModelForProvider("codex-local")).toBe("gpt-5.4");
    expect(providerModeForConfig({ provider: "codex-local" })).toEqual({
      label: "Codex Local",
      description: "Uses your local Codex ChatGPT sign-in. Requires this app to run on your machine.",
      isQualityMode: false,
      isLocalDraftMode: true,
    });
  });

  it("sizes internal candidate pools above the requested count", () => {
    expect(candidatePoolSize(1)).toBe(8);
    expect(candidatePoolSize(3)).toBe(8);
    expect(candidatePoolSize(5)).toBe(12);
    expect(candidatePoolSize(10)).toBe(16);
  });
});
