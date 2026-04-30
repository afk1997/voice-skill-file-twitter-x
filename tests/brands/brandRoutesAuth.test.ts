import { beforeEach, describe, expect, it, vi } from "vitest";
import { BrandAccessError } from "@/lib/auth/errors";

const authBridge = vi.hoisted(() => ({
  ensureCurrentUserProfile: vi.fn(),
}));
const accessBridge = vi.hoisted(() => ({
  assertBrandAccess: vi.fn(),
  createBrandForProfile: vi.fn(),
}));
const dbBridge = vi.hoisted(() => ({
  prisma: {
    brand: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock("@/lib/auth/currentUserProfile", () => authBridge);
vi.mock("@/lib/auth/brandAccess", () => accessBridge);
vi.mock("@/lib/db", () => dbBridge);

describe("brand route auth", () => {
  beforeEach(() => vi.clearAllMocks());

  it("creates brands for the current profile", async () => {
    authBridge.ensureCurrentUserProfile.mockResolvedValue({ id: "profile1" });
    accessBridge.createBrandForProfile.mockResolvedValue({ id: "brand1", name: "Acme" });
    const { POST } = await import("@/app/api/brands/route");

    const response = await POST(new Request("http://localhost/api/brands", { method: "POST", body: JSON.stringify({ name: "Acme" }) }));

    expect(accessBridge.createBrandForProfile).toHaveBeenCalledWith({
      profileId: "profile1",
      input: expect.objectContaining({ name: "Acme" }),
    });
    await expect(response.json()).resolves.toMatchObject({ brand: { id: "brand1" } });
  });

  it("returns 404 when a user lacks brand access", async () => {
    authBridge.ensureCurrentUserProfile.mockResolvedValue({ id: "profile2" });
    accessBridge.assertBrandAccess.mockRejectedValue(new BrandAccessError());
    const { GET } = await import("@/app/api/brands/[brandId]/route");

    const response = await GET(new Request("http://localhost/api/brands/brand1"), { params: Promise.resolve({ brandId: "brand1" }) });

    expect(response.status).toBe(404);
  });
});
