import { afterEach, describe, expect, it, vi } from "vitest";

const codexBridge = vi.hoisted(() => ({
  generateTextWithCodex: vi.fn(),
}));

vi.mock("@/lib/codex/appServer", () => codexBridge);

describe("Codex Local LLM client", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("routes JSON generation through Codex Local without requiring an API key", async () => {
    codexBridge.generateTextWithCodex.mockResolvedValue("{\"ok\":true}");
    const { generateJsonWithLlm, hasUsableProvider } = await import("@/lib/llm/client");

    expect(hasUsableProvider({ provider: "codex-local" })).toBe(true);
    await expect(
      generateJsonWithLlm<{ ok: boolean }>({
        providerConfig: { provider: "codex-local" },
        prompt: "Return JSON.",
      }),
    ).resolves.toEqual({ ok: true });

    expect(codexBridge.generateTextWithCodex).toHaveBeenCalledWith({
      prompt: "Return JSON.",
      model: "gpt-5.4",
    });
  });

  it("uses Codex Local for JSON repair follow-up calls", async () => {
    codexBridge.generateTextWithCodex
      .mockResolvedValueOnce("{\"ok\": true\n\"items\": []}")
      .mockResolvedValueOnce("{\"ok\":true,\"items\":[]}");
    const { generateJsonWithLlm } = await import("@/lib/llm/client");

    await expect(
      generateJsonWithLlm<{ ok: boolean; items: string[] }>({
        providerConfig: { provider: "codex-local", model: "gpt-5.5" },
        prompt: "Return JSON.",
      }),
    ).resolves.toEqual({ ok: true, items: [] });

    expect(codexBridge.generateTextWithCodex).toHaveBeenCalledTimes(2);
    expect(codexBridge.generateTextWithCodex).toHaveBeenLastCalledWith(
      expect.objectContaining({
        model: "gpt-5.5",
      }),
    );
  });
});
