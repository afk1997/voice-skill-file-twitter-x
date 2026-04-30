import { describe, expect, it, vi } from "vitest";
import { BrandAccessError } from "@/lib/auth/errors";
import { assertBrandAccess, claimLegacyBrands, createBrandForProfile } from "@/lib/auth/brandAccess";

describe("brandAccess", () => {
  it("allows members to access a brand", async () => {
    const membership = { id: "membership1", brandId: "brand1", userProfileId: "profile1", role: "OWNER" };
    const findUnique = vi.fn().mockResolvedValue(membership);
    const result = await assertBrandAccess({
      prisma: { brandMembership: { findUnique } },
      profileId: "profile1",
      brandId: "brand1",
    });

    expect(result).toBe(membership);
    expect(findUnique).toHaveBeenCalledWith({
      where: { brandId_userProfileId: { brandId: "brand1", userProfileId: "profile1" } },
    });
  });

  it("rejects non-members with a not-found style error", async () => {
    await expect(
      assertBrandAccess({
        prisma: { brandMembership: { findUnique: vi.fn().mockResolvedValue(null) } },
        profileId: "profile2",
        brandId: "brand1",
      }),
    ).rejects.toBeInstanceOf(BrandAccessError);
  });

  it("creates a brand and owner membership in one transaction", async () => {
    const createBrand = vi.fn().mockResolvedValue({ id: "brand1", name: "Acme" });
    const createMembership = vi.fn().mockResolvedValue({ id: "membership1" });
    const transaction = vi.fn((callback) =>
      callback({
        brand: { create: createBrand },
        brandMembership: { create: createMembership },
      }),
    );

    const brand = await createBrandForProfile({
      prisma: { $transaction: transaction },
      profileId: "profile1",
      input: { name: "Acme" },
    } as never);

    expect(brand.id).toBe("brand1");
    expect(createMembership).toHaveBeenCalledWith({
      data: { brandId: "brand1", userProfileId: "profile1", role: "OWNER" },
    });
  });

  it("claims only brands without memberships", async () => {
    const createMany = vi.fn().mockResolvedValue({ count: 2 });
    const findMany = vi.fn().mockResolvedValue([{ id: "brand1" }, { id: "brand2" }]);
    const result = await claimLegacyBrands({
      prisma: {
        brand: { findMany },
        brandMembership: { createMany },
      },
      profileId: "profile1",
    });

    expect(findMany).toHaveBeenCalledWith({
      where: { memberships: { none: {} } },
      select: { id: true },
    });
    expect(createMany).toHaveBeenCalledWith({
      data: [
        { brandId: "brand1", userProfileId: "profile1", role: "OWNER" },
        { brandId: "brand2", userProfileId: "profile1", role: "OWNER" },
      ],
      skipDuplicates: true,
    });
    expect(result.claimedCount).toBe(2);
  });
});
