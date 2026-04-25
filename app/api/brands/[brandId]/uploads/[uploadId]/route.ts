import { prisma } from "@/lib/db";
import { jsonError, jsonErrorFromUnknown, jsonOk } from "@/lib/request";

export async function DELETE(_request: Request, { params }: { params: Promise<{ brandId: string; uploadId: string }> }) {
  const { brandId, uploadId } = await params;

  try {
    const upload = await prisma.upload.findFirst({
      where: { id: uploadId, brandId },
      select: { id: true },
    });

    if (!upload) return jsonError("Upload not found.", 404);

    const [deletedSamples] = await prisma.$transaction([
      prisma.contentSample.deleteMany({ where: { brandId, uploadId } }),
      prisma.upload.delete({ where: { id: uploadId } }),
    ]);

    return jsonOk({ deleted: true, deletedSamples: deletedSamples.count });
  } catch (error) {
    return jsonErrorFromUnknown(error, "Could not delete upload.", 500);
  }
}
