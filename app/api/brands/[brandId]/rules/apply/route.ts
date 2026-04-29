import { prisma } from "@/lib/db";
import { jsonError, jsonErrorFromUnknown, jsonOk } from "@/lib/request";
import { applyRulePreview } from "@/lib/rules/ruleBankService";

export async function POST(request: Request, { params }: { params: Promise<{ brandId: string }> }) {
  try {
    const { brandId } = await params;
    const body = await request.json();
    if (!body.previewId || typeof body.previewId !== "string") return jsonError("previewId is required.", 400);
    return jsonOk(await applyRulePreview({ prisma, brandId, previewId: body.previewId }));
  } catch (error) {
    if (error instanceof Error) return jsonError(error.message, 400);
    return jsonErrorFromUnknown(error, "Could not apply rules.", 500);
  }
}
