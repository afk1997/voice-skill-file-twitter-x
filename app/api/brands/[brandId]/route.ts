import { prisma } from "@/lib/db";
import { jsonError, jsonOk, parseJsonField } from "@/lib/request";

export async function GET(_request: Request, { params }: { params: Promise<{ brandId: string }> }) {
  const { brandId } = await params;
  const brand = await prisma.brand.findUnique({
    where: { id: brandId },
    include: {
      uploads: { orderBy: { createdAt: "desc" }, take: 5 },
      voiceReports: { orderBy: { createdAt: "desc" }, take: 1 },
      skillFiles: { orderBy: { createdAt: "desc" }, take: 1 },
      _count: { select: { contentSamples: true, generations: true } },
    },
  });

  if (!brand) return jsonError("Brand not found.", 404);

  return jsonOk({
    brand: {
      ...brand,
      uploads: brand.uploads.map((upload) => ({
        ...upload,
        summaryJson: parseJsonField(upload.summaryJson, null),
      })),
      voiceReports: brand.voiceReports.map((report) => ({
        ...report,
        reportJson: parseJsonField(report.reportJson, null),
      })),
      skillFiles: brand.skillFiles.map((skillFile) => ({
        ...skillFile,
        skillJson: parseJsonField(skillFile.skillJson, null),
      })),
    },
  });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ brandId: string }> }) {
  const { brandId } = await params;
  const body = await request.json();
  const brand = await prisma.brand.update({
    where: { id: brandId },
    data: {
      name: body.name,
      twitterHandle: body.twitterHandle,
      website: body.website,
      category: body.category,
      audience: body.audience,
      description: body.description,
      beliefs: body.beliefs,
      avoidSoundingLike: body.avoidSoundingLike,
    },
  });
  return jsonOk({ brand });
}
