import { beforeEach, describe, expect, it, vi } from "vitest";

const service = vi.hoisted(() => ({
  listGlobalRules: vi.fn(),
  createCustomRule: vi.fn(),
  updateCustomRule: vi.fn(),
  listApplicableBrandRules: vi.fn(),
  saveBrandRuleSelections: vi.fn(),
  previewSelectedRules: vi.fn(),
  applyRulePreview: vi.fn(),
}));

const authBridge = vi.hoisted(() => ({
  ensureCurrentUserProfile: vi.fn(),
}));

const accessBridge = vi.hoisted(() => ({
  assertBrandAccess: vi.fn(),
}));

vi.mock("@/lib/rules/ruleBankService", () => service);
vi.mock("@/lib/auth/currentUserProfile", () => authBridge);
vi.mock("@/lib/auth/brandAccess", () => accessBridge);
vi.mock("@/lib/db", () => ({ prisma: {} }));

describe("rules API routes", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    authBridge.ensureCurrentUserProfile.mockResolvedValue({ id: "profile1" });
    accessBridge.assertBrandAccess.mockResolvedValue(undefined);
  });

  it("lists global rules", async () => {
    service.listGlobalRules.mockResolvedValue([{ id: "r1" }]);
    const { GET } = await import("@/app/api/rules/route");
    const response = await GET();
    expect(response.status).toBe(200);
    expect(service.listGlobalRules).toHaveBeenCalledWith({ prisma: {}, profileId: "profile1" });
    await expect(response.json()).resolves.toEqual({ rules: [{ id: "r1" }] });
  });

  it("creates a global custom rule", async () => {
    service.createCustomRule.mockResolvedValue({ id: "r2" });
    const { POST } = await import("@/app/api/rules/route");
    const response = await POST(new Request("http://localhost/api/rules", { method: "POST", body: JSON.stringify({ title: "Rule", body: "Body" }) }));
    expect(response.status).toBe(200);
    expect(service.createCustomRule).toHaveBeenCalledWith(expect.objectContaining({ profileId: "profile1" }));
    await expect(response.json()).resolves.toEqual({ rule: { id: "r2" } });
  });

  it("returns service errors as 400s for invalid custom rules", async () => {
    service.createCustomRule.mockRejectedValue(new Error("Rule title is required."));
    const { POST } = await import("@/app/api/rules/route");
    const response = await POST(new Request("http://localhost/api/rules", { method: "POST", body: JSON.stringify({}) }));
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Rule title is required." });
  });

  it("saves brand selections", async () => {
    service.saveBrandRuleSelections.mockResolvedValue({ ok: true });
    const { PATCH } = await import("@/app/api/brands/[brandId]/rules/selections/route");
    const response = await PATCH(
      new Request("http://localhost/api/brands/b1/rules/selections", { method: "PATCH", body: JSON.stringify({ selections: [{ ruleId: "r1", selected: true }] }) }),
      { params: Promise.resolve({ brandId: "b1" }) },
    );
    expect(response.status).toBe(200);
    expect(service.saveBrandRuleSelections).toHaveBeenCalledWith(expect.objectContaining({ brandId: "b1", selections: [{ ruleId: "r1", selected: true }] }));
  });

  it("previews selected rules", async () => {
    service.previewSelectedRules.mockResolvedValue({ preview: { id: "p1" }, compiled: { items: ["Add rule"] } });
    const { POST } = await import("@/app/api/brands/[brandId]/rules/preview/route");
    const response = await POST(new Request("http://localhost/api/brands/b1/rules/preview", { method: "POST", body: "{}" }), { params: Promise.resolve({ brandId: "b1" }) });
    expect(response.status).toBe(200);
    expect(service.previewSelectedRules).toHaveBeenCalledWith({ prisma: {}, brandId: "b1", profileId: "profile1" });
    await expect(response.json()).resolves.toEqual({ preview: { id: "p1" }, compiled: { items: ["Add rule"] } });
  });

  it("applies a preview", async () => {
    service.applyRulePreview.mockResolvedValue({ skillFile: { id: "sf2", version: "v1.1" }, application: { id: "p1" } });
    const { POST } = await import("@/app/api/brands/[brandId]/rules/apply/route");
    const response = await POST(new Request("http://localhost/api/brands/b1/rules/apply", { method: "POST", body: JSON.stringify({ previewId: "p1" }) }), {
      params: Promise.resolve({ brandId: "b1" }),
    });
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ skillFile: { version: "v1.1" } });
  });
});
