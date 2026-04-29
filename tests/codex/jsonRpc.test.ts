import { describe, expect, it, vi } from "vitest";
import { CodexJsonRpcPeer } from "@/lib/codex/jsonRpc";

describe("CodexJsonRpcPeer", () => {
  it("sends requests with ids and resolves matching responses", async () => {
    const writes: string[] = [];
    const peer = new CodexJsonRpcPeer({ write: (line) => writes.push(line), timeoutMs: 1000 });

    const pending = peer.request("account/read", { refreshToken: false });
    expect(JSON.parse(writes[0])).toEqual({
      method: "account/read",
      id: 1,
      params: { refreshToken: false },
    });

    peer.handleLine(JSON.stringify({ id: 1, result: { account: null } }));
    await expect(pending).resolves.toEqual({ account: null });
  });

  it("rejects matching error responses", async () => {
    const peer = new CodexJsonRpcPeer({ write: vi.fn(), timeoutMs: 1000 });
    const pending = peer.request("account/rateLimits/read");

    peer.handleLine(JSON.stringify({ id: 1, error: { code: -32000, message: "Not signed in" } }));

    await expect(pending).rejects.toThrow("Not signed in");
  });

  it("delivers notifications to listeners", () => {
    const peer = new CodexJsonRpcPeer({ write: vi.fn(), timeoutMs: 1000 });
    const handler = vi.fn();
    const unsubscribe = peer.onNotification("account/updated", handler);

    peer.handleLine(JSON.stringify({ method: "account/updated", params: { authMode: "chatgpt", planType: "plus" } }));
    unsubscribe();
    peer.handleLine(JSON.stringify({ method: "account/updated", params: { authMode: null, planType: null } }));

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith({ authMode: "chatgpt", planType: "plus" });
  });

  it("rejects pending requests when closed", async () => {
    const peer = new CodexJsonRpcPeer({ write: vi.fn(), timeoutMs: 1000 });
    const pending = peer.request("thread/start");

    peer.close(new Error("codex app-server exited"));

    await expect(pending).rejects.toThrow("codex app-server exited");
  });
});
