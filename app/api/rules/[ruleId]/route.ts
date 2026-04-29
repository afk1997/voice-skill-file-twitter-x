import { prisma } from "@/lib/db";
import { jsonError, jsonErrorFromUnknown, jsonOk } from "@/lib/request";
import { updateCustomRule } from "@/lib/rules/ruleBankService";

export async function PATCH(request: Request, { params }: { params: Promise<{ ruleId: string }> }) {
  try {
    const { ruleId } = await params;
    const body = await request.json();
    const rule = await updateCustomRule({
      prisma,
      ruleId,
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
    if (error instanceof Error) return jsonError(error.message, 400);
    return jsonErrorFromUnknown(error, "Could not update rule.", 500);
  }
}
