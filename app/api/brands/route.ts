import { prisma } from "@/lib/db";
import { jsonError, jsonOk } from "@/lib/request";

export async function GET() {
  const brands = await prisma.brand.findMany({
    orderBy: { updatedAt: "desc" },
    include: {
      _count: { select: { contentSamples: true, skillFiles: true } },
    },
  });
  return jsonOk({ brands });
}

export async function POST(request: Request) {
  const body = await request.json();
  if (!body.name || typeof body.name !== "string") {
    return jsonError("Brand name is required.", 400);
  }

  const brand = await prisma.brand.create({
    data: {
      name: body.name,
      twitterHandle: body.twitterHandle || null,
      website: body.website || null,
      category: body.category || null,
      audience: body.audience || null,
      description: body.description || null,
      beliefs: body.beliefs || null,
      avoidSoundingLike: body.avoidSoundingLike || null,
    },
  });

  return jsonOk({ brand }, { status: 201 });
}
