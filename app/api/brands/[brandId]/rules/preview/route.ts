import { assertBrandAccess } from "@/lib/auth/brandAccess";
import { authErrorStatus } from "@/lib/auth/errors";
import { ensureCurrentUserProfile } from "@/lib/auth/currentUserProfile";
import { prisma } from "@/lib/db";
import { jsonError, jsonErrorFromUnknown, jsonOk } from "@/lib/request";
import { previewSelectedRules } from "@/lib/rules/ruleBankService";

export async function POST(_request: Request, { params }: { params: Promise<{ brandId: string }> }) {
  try {
    const { brandId } = await params;
    const profile = await ensureCurrentUserProfile();
    await assertBrandAccess({ profileId: profile.id, brandId });
    return jsonOk(await previewSelectedRules({ prisma, brandId, profileId: profile.id }));
  } catch (error) {
    if (error instanceof Error) return jsonError(error.message, authErrorStatus(error) === 500 ? 400 : authErrorStatus(error));
    return jsonErrorFromUnknown(error, "Could not preview rules.", 500);
  }
}
