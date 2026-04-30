import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

export function scopedBrandWorkspaceQuery(profileId: string) {
  return {
    where: { memberships: { some: { userProfileId: profileId } } },
    orderBy: { updatedAt: "desc" },
    include: {
      _count: { select: { contentSamples: true, skillFiles: true } },
      skillFiles: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  } satisfies Prisma.BrandFindManyArgs;
}

export const brandWorkspaceQuery = scopedBrandWorkspaceQuery;
export type BrandWorkspace = Prisma.BrandGetPayload<ReturnType<typeof scopedBrandWorkspaceQuery>>;

type LoadBrandWorkspaces = (query: ReturnType<typeof scopedBrandWorkspaceQuery>) => Promise<BrandWorkspace[]>;

function loadBrandWorkspaces(query: ReturnType<typeof scopedBrandWorkspaceQuery>) {
  return prisma.brand.findMany(query);
}

export async function listBrandWorkspaces(profileId: string, load: LoadBrandWorkspaces = loadBrandWorkspaces) {
  try {
    return {
      brands: await load(scopedBrandWorkspaceQuery(profileId)),
      loadError: null,
    };
  } catch (error) {
    console.error("Failed to load brand workspaces.", error);
    return {
      brands: [],
      loadError: "Brand workspaces could not be loaded. Check the database connection and try again.",
    };
  }
}
