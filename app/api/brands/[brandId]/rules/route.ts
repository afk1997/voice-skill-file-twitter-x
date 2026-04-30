import { assertBrandAccess } from "@/lib/auth/brandAccess";
import { authErrorStatus } from "@/lib/auth/errors";
import { ensureCurrentUserProfile } from "@/lib/auth/currentUserProfile";
import { prisma } from "@/lib/db";
import { jsonError, jsonErrorFromUnknown, jsonOk } from "@/lib/request";
import { createCustomRule, listApplicableBrandRules } from "@/lib/rules/ruleBankService";

export async function GET(_request: Request, { params }: { params: Promise<{ brandId: string }> }) {
  try {
    const { brandId } = await params;
    const profile = await ensureCurrentUserProfile();
    await assertBrandAccess({ profileId: profile.id, brandId });
    return jsonOk(await listApplicableBrandRules({ prisma, brandId }));
  } catch (error) {
    if (error instanceof Error) return jsonError(error.message, authErrorStatus(error));
    return jsonErrorFromUnknown(error, "Could not load brand rules.", 500);
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ brandId: string }> }) {
  try {
    const { brandId } = await params;
    const profile = await ensureCurrentUserProfile();
    await assertBrandAccess({ profileId: profile.id, brandId });
    const body = await request.json();
    const rule = await createCustomRule({
      prisma,
      brandId,
      input: {
        title: body.title,
        body: body.body,
        category: body.category || "specificity",
        mode: body.mode || "guidance",
        scope: "brand",
        targetJson: body.targetJson || ["skill_rules"],
        payloadJson: body.payloadJson || {},
      },
    });
    return jsonOk({ rule });
  } catch (error) {
    if (error instanceof Error) return jsonError(error.message, authErrorStatus(error) === 500 ? 400 : authErrorStatus(error));
    return jsonErrorFromUnknown(error, "Could not create brand rule.", 500);
  }
}
