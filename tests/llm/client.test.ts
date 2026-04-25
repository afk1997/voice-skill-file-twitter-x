import { afterEach, describe, expect, it, vi } from "vitest";
import { generateJsonWithLlm } from "@/lib/llm/client";

describe("generateJsonWithLlm", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("does not send OpenAI json_object response_format to OpenAI-compatible providers", async () => {
    let requestBody: Record<string, unknown> | undefined;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
        requestBody = JSON.parse(String(init?.body));
        return new Response(JSON.stringify({ choices: [{ message: { content: "{\"ok\":true}" } }] }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }),
    );

    const result = await generateJsonWithLlm<{ ok: boolean }>({
      providerConfig: {
        provider: "openai-compatible",
        baseUrl: "http://localhost:1234/v1",
        model: "google/gemma-4-e4b",
        apiKey: "test-key",
      },
      prompt: "Return JSON.",
    });

    expect(result).toEqual({ ok: true });
    expect(requestBody?.response_format).toBeUndefined();
  });

  it("parses JSON objects when a local model adds surrounding prose", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(JSON.stringify({ choices: [{ message: { content: "Here is the JSON:\n{\"ok\":true}\nDone." } }] }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      ),
    );

    await expect(
      generateJsonWithLlm<{ ok: boolean }>({
        providerConfig: {
          provider: "openai-compatible",
          baseUrl: "http://localhost:1234/v1",
          model: "google/gemma-4-e4b",
          apiKey: "test-key",
        },
        prompt: "Return JSON.",
      }),
    ).resolves.toEqual({ ok: true });
  });
});
