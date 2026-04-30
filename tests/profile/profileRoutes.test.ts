import { beforeEach, describe, expect, it, vi } from "vitest";

const authBridge = vi.hoisted(() => ({
  ensureCurrentUserProfile: vi.fn(),
  serializeProfile: vi.fn((profile) => ({ ...profile, bio: profile.bio ?? "" })),
}));
const accessBridge = vi.hoisted(() => ({
  claimLegacyBrands: vi.fn(),
}));
const dbBridge = vi.hoisted(() => ({
  prisma: { userProfile: { update: vi.fn() } },
}));

vi.mock("@/lib/auth/currentUserProfile", () => authBridge);
vi.mock("@/lib/auth/brandAccess", () => accessBridge);
vi.mock("@/lib/db", () => dbBridge);

describe("profile routes", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns the current profile", async () => {
    authBridge.ensureCurrentUserProfile.mockResolvedValue({ id: "profile1", bio: null });
    const { GET } = await import("@/app/api/profile/route");

    const response = await GET();

    await expect(response.json()).resolves.toMatchObject({ profile: { id: "profile1", bio: "" } });
  });

  it("updates local profile fields", async () => {
    authBridge.ensureCurrentUserProfile.mockResolvedValue({ id: "profile1" });
    dbBridge.prisma.userProfile.update.mockResolvedValue({ id: "profile1", displayName: "Kai", bio: "Builder" });
    const { PATCH } = await import("@/app/api/profile/route");

    const response = await PATCH(new Request("http://localhost/api/profile", { method: "PATCH", body: JSON.stringify({ displayName: "Kai", bio: "Builder" }) }));

    expect(dbBridge.prisma.userProfile.update).toHaveBeenCalledWith({
      where: { id: "profile1" },
      data: { displayName: "Kai", bio: "Builder" },
    });
    await expect(response.json()).resolves.toMatchObject({ profile: { displayName: "Kai" } });
  });

  it("claims legacy brands for the current profile", async () => {
    authBridge.ensureCurrentUserProfile.mockResolvedValue({ id: "profile1" });
    accessBridge.claimLegacyBrands.mockResolvedValue({ claimedCount: 3 });
    const { POST } = await import("@/app/api/profile/claim-legacy-brands/route");

    const response = await POST();

    expect(accessBridge.claimLegacyBrands).toHaveBeenCalledWith({ profileId: "profile1" });
    await expect(response.json()).resolves.toEqual({ claimedCount: 3 });
  });
});
