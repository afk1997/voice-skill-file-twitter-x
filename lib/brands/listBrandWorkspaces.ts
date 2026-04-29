import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

export const brandWorkspaceQuery = {
  orderBy: { updatedAt: "desc" },
  include: {
    _count: { select: { contentSamples: true, skillFiles: true } },
    skillFiles: { orderBy: { createdAt: "desc" }, take: 1 },
  },
} satisfies Prisma.BrandFindManyArgs;

export type BrandWorkspace = Prisma.BrandGetPayload<typeof brandWorkspaceQuery>;

type LoadBrandWorkspaces = () => Promise<BrandWorkspace[]>;

function loadBrandWorkspaces() {
  return prisma.brand.findMany(brandWorkspaceQuery);
}

export async function listBrandWorkspaces(load: LoadBrandWorkspaces = loadBrandWorkspaces) {
  try {
    return {
      brands: await load(),
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
