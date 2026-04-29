import { beforeEach, describe, expect, it, vi } from "vitest";

const bridge = vi.hoisted(() => ({
  readCodexStatus: vi.fn(),
  startCodexDeviceLogin: vi.fn(),
  cancelCodexLogin: vi.fn(),
  logoutCodex: vi.fn(),
}));

vi.mock("@/lib/codex/appServer", () => bridge);

describe("Codex Local API routes", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("returns sanitized status", async () => {
    bridge.readCodexStatus.mockResolvedValue({
      available: true,
      connected: true,
      account: { type: "chatgpt", email: "user@example.com", planType: "plus" },
      rateLimits: { limitId: "codex", usedPercent: 10 },
    });

    const { GET } = await import("@/app/api/codex/status/route");
    const response = await GET();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ connected: true, account: { email: "user@example.com" } });
  });

  it("starts device-code login", async () => {
    bridge.startCodexDeviceLogin.mockResolvedValue({
      type: "chatgptDeviceCode",
      loginId: "login-1",
      verificationUrl: "https://auth.openai.com/codex/device",
      userCode: "ABCD-1234",
    });

    const { POST } = await import("@/app/api/codex/login/start/route");
    const response = await POST();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ loginId: "login-1", userCode: "ABCD-1234" });
  });

  it("requires loginId when canceling login", async () => {
    const { POST } = await import("@/app/api/codex/login/cancel/route");
    const response = await POST(new Request("http://localhost/api/codex/login/cancel", { method: "POST", body: "{}" }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "loginId is required." });
  });

  it("logs out", async () => {
    bridge.logoutCodex.mockResolvedValue({});

    const { POST } = await import("@/app/api/codex/logout/route");
    const response = await POST();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
  });
});
