import type { Prisma } from "@prisma/client";
import { BrandAccessError } from "@/lib/auth/errors";
import { prisma } from "@/lib/db";

type PrismaLike = Record<string, any>;

export async function assertBrandAccess({ prisma: client = prisma, profileId, brandId }: { prisma?: PrismaLike; profileId: string; brandId: string }) {
  const membership = await client.brandMembership.findUnique({
    where: { brandId_userProfileId: { brandId, userProfileId: profileId } },
  });
  if (!membership) throw new BrandAccessError();
  return membership;
}

export async function createBrandForProfile({
  prisma: client = prisma,
  profileId,
  input,
}: {
  prisma?: PrismaLike;
  profileId: string;
  input: Prisma.BrandCreateInput;
}) {
  return client.$transaction(async (tx: PrismaLike) => {
    const brand = await tx.brand.create({ data: input });
    await tx.brandMembership.create({
      data: { brandId: brand.id, userProfileId: profileId, role: "OWNER" },
    });
    return brand;
  });
}

export async function findUnownedBrands({ prisma: client = prisma }: { prisma?: PrismaLike } = {}) {
  return client.brand.findMany({
    where: { memberships: { none: {} } },
    orderBy: { updatedAt: "desc" },
    select: { id: true, name: true, twitterHandle: true, category: true },
  });
}

export async function claimLegacyBrands({ prisma: client = prisma, profileId }: { prisma?: PrismaLike; profileId: string }) {
  const brands = await client.brand.findMany({
    where: { memberships: { none: {} } },
    select: { id: true },
  });
  if (brands.length === 0) return { claimedCount: 0 };

  const result = await client.brandMembership.createMany({
    data: brands.map((brand: { id: string }) => ({ brandId: brand.id, userProfileId: profileId, role: "OWNER" })),
    skipDuplicates: true,
  });
  return { claimedCount: result.count ?? brands.length };
}
