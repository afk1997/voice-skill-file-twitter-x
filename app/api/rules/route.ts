import { authErrorStatus } from "@/lib/auth/errors";
import { ensureCurrentUserProfile } from "@/lib/auth/currentUserProfile";
import { prisma } from "@/lib/db";
import { jsonError, jsonErrorFromUnknown, jsonOk } from "@/lib/request";
import { createCustomRule, listGlobalRules } from "@/lib/rules/ruleBankService";

export async function GET() {
  try {
    const profile = await ensureCurrentUserProfile();
    return jsonOk({ rules: await listGlobalRules({ prisma, profileId: profile.id }) });
  } catch (error) {
    if (error instanceof Error && authErrorStatus(error) !== 500) return jsonError(error.message, authErrorStatus(error));
    return jsonErrorFromUnknown(error, "Could not load rules.", 500);
  }
}

export async function POST(request: Request) {
  try {
    const profile = await ensureCurrentUserProfile();
    const body = await request.json();
    const rule = await createCustomRule({
      prisma,
      profileId: profile.id,
      input: {
        title: body.title,
        body: body.body,
        category: body.category || "specificity",
        mode: body.mode || "guidance",
        scope: "global",
        targetJson: body.targetJson || ["skill_rules"],
        payloadJson: body.payloadJson || {},
      },
    });
    return jsonOk({ rule });
  } catch (error) {
    if (error instanceof Error) return jsonError(error.message, authErrorStatus(error) === 500 ? 400 : authErrorStatus(error));
    return jsonErrorFromUnknown(error, "Could not create rule.", 500);
  }
}
