import { describe, expect, it } from "vitest";
import { jsonErrorFromUnknown, providerConfigFromBody } from "@/lib/request";

describe("jsonErrorFromUnknown", () => {
  it("returns a JSON response for thrown errors", async () => {
    const response = jsonErrorFromUnknown(new Error("Provider request failed."), "Could not analyze voice.", 502);

    expect(response.status).toBe(502);
    expect(response.headers.get("content-type")).toContain("application/json");
    await expect(response.json()).resolves.toEqual({ error: "Provider request failed." });
  });
});

describe("providerConfigFromBody", () => {
  it("keeps valid context window tokens from browser-supplied provider config", () => {
    expect(
      providerConfigFromBody({
        providerConfig: {
          provider: "openai-compatible",
          contextWindowTokens: 32768,
        },
      }),
    ).toMatchObject({ provider: "openai-compatible", contextWindowTokens: 32768 });
  });

  it("preserves Codex Local provider config without requiring browser credentials", () => {
    expect(
      providerConfigFromBody({
        providerConfig: {
          provider: "codex-local",
          model: "gpt-5.4",
          apiKey: "ignored-browser-key",
          baseUrl: "http://localhost:9999",
          embeddingModel: "ignored-embedding-model",
        },
      }),
    ).toEqual({
      provider: "codex-local",
      apiKey: undefined,
      model: "gpt-5.4",
      embeddingModel: undefined,
      baseUrl: undefined,
      contextWindowTokens: undefined,
    });
  });
});
