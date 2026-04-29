import { prisma } from "@/lib/db";
import { jsonError, jsonErrorFromUnknown, jsonOk } from "@/lib/request";
import { createCustomRule, listGlobalRules } from "@/lib/rules/ruleBankService";

export async function GET() {
  return jsonOk({ rules: await listGlobalRules({ prisma }) });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const rule = await createCustomRule({
      prisma,
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
    if (error instanceof Error) return jsonError(error.message, 400);
    return jsonErrorFromUnknown(error, "Could not create rule.", 500);
  }
}
