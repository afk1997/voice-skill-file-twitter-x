import { prisma } from "@/lib/db";
import { jsonError, jsonErrorFromUnknown, jsonOk } from "@/lib/request";
import { previewSelectedRules } from "@/lib/rules/ruleBankService";

export async function POST(_request: Request, { params }: { params: Promise<{ brandId: string }> }) {
  try {
    const { brandId } = await params;
    return jsonOk(await previewSelectedRules({ prisma, brandId }));
  } catch (error) {
    if (error instanceof Error) return jsonError(error.message, 400);
    return jsonErrorFromUnknown(error, "Could not preview rules.", 500);
  }
}
