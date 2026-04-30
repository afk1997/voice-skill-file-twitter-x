import { authErrorStatus } from "@/lib/auth/errors";
import { ensureCurrentUserProfile } from "@/lib/auth/currentUserProfile";
import { prisma } from "@/lib/db";
import { jsonError, jsonErrorFromUnknown, jsonOk } from "@/lib/request";
import { updateCustomRule } from "@/lib/rules/ruleBankService";

export async function PATCH(request: Request, { params }: { params: Promise<{ ruleId: string }> }) {
  try {
    const { ruleId } = await params;
    const profile = await ensureCurrentUserProfile();
    const body = await request.json();
    const rule = await updateCustomRule({
      prisma,
      ruleId,
      profileId: profile.id,
      input: {
        title: body.title,
        body: body.body,
        category: body.category,
        mode: body.mode,
        scope: "global",
        targetJson: body.targetJson,
        payloadJson: body.payloadJson || {},
      },
    });
    return jsonOk({ rule });
  } catch (error) {
    if (error instanceof Error) return jsonError(error.message, authErrorStatus(error) === 500 ? 400 : authErrorStatus(error));
    return jsonErrorFromUnknown(error, "Could not update rule.", 500);
  }
}
