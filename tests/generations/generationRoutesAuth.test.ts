import { beforeEach, describe, expect, it, vi } from "vitest";

const authBridge = vi.hoisted(() => ({
  ensureCurrentUserProfile: vi.fn(),
}));

const accessBridge = vi.hoisted(() => ({
  assertBrandAccess: vi.fn(),
}));

const dbBridge = vi.hoisted(() => ({
  prisma: {
    generation: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    feedback: {
      create: vi.fn(),
    },
    skillFile: {
      findFirst: vi.fn(),
      create: vi.fn(),
    },
    contentSample: {
      findMany: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock("@/lib/auth/currentUserProfile", () => authBridge);
vi.mock("@/lib/auth/brandAccess", () => accessBridge);
vi.mock("@/lib/db", () => dbBridge);

describe("generation route auth", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    authBridge.ensureCurrentUserProfile.mockResolvedValue({ id: "profile1" });
  });

  it("checks brand access before saving feedback", async () => {
    const { BrandAccessError } = await import("@/lib/auth/errors");
    dbBridge.prisma.generation.findUnique.mockResolvedValue({ id: "g1", brandId: "brand1", outputText: "Draft" });
    accessBridge.assertBrandAccess.mockRejectedValue(new BrandAccessError());

    const { POST } = await import("@/app/api/generations/[generationId]/feedback/route");
    const response = await POST(
      new Request("http://localhost/api/generations/g1/feedback", { method: "POST", body: JSON.stringify({ label: "Too generic" }) }),
      { params: Promise.resolve({ generationId: "g1" }) },
    );

    expect(response.status).toBe(404);
    expect(accessBridge.assertBrandAccess).toHaveBeenCalledWith({ profileId: "profile1", brandId: "brand1" });
    expect(dbBridge.prisma.feedback.create).not.toHaveBeenCalled();
  });

  it("checks brand access before revising a generation", async () => {
    const { BrandAccessError } = await import("@/lib/auth/errors");
    dbBridge.prisma.generation.findUnique.mockResolvedValue({
      id: "g1",
      brandId: "brand1",
      prompt: "Launch note",
      outputText: "Draft",
      tweetType: "single tweet",
      feedback: [],
    });
    accessBridge.assertBrandAccess.mockRejectedValue(new BrandAccessError());

    const { POST } = await import("@/app/api/generations/[generationId]/revise/route");
    const response = await POST(new Request("http://localhost/api/generations/g1/revise", { method: "POST", body: JSON.stringify({}) }), {
      params: Promise.resolve({ generationId: "g1" }),
    });

    expect(response.status).toBe(404);
    expect(accessBridge.assertBrandAccess).toHaveBeenCalledWith({ profileId: "profile1", brandId: "brand1" });
    expect(dbBridge.prisma.skillFile.findFirst).not.toHaveBeenCalled();
  });
});
