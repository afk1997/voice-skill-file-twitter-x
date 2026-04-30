import { assertBrandAccess } from "@/lib/auth/brandAccess";
import { authErrorStatus } from "@/lib/auth/errors";
import { ensureCurrentUserProfile } from "@/lib/auth/currentUserProfile";
import { prisma } from "@/lib/db";
import { jsonError, jsonErrorFromUnknown, jsonOk } from "@/lib/request";
import { saveBrandRuleSelections } from "@/lib/rules/ruleBankService";

export async function PATCH(request: Request, { params }: { params: Promise<{ brandId: string }> }) {
  try {
    const { brandId } = await params;
    const profile = await ensureCurrentUserProfile();
    await assertBrandAccess({ profileId: profile.id, brandId });
    const body = await request.json();
    if (!Array.isArray(body.selections)) return jsonError("Selections must be an array.", 400);
    return jsonOk(await saveBrandRuleSelections({ prisma, brandId, selections: body.selections }));
  } catch (error) {
    if (error instanceof Error && authErrorStatus(error) !== 500) return jsonError(error.message, authErrorStatus(error));
    return jsonErrorFromUnknown(error, "Could not save rule selections.", 500);
  }
}
