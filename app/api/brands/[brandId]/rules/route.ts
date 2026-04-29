import { prisma } from "@/lib/db";
import { jsonError, jsonErrorFromUnknown, jsonOk } from "@/lib/request";
import { createCustomRule, listApplicableBrandRules } from "@/lib/rules/ruleBankService";

export async function GET(_request: Request, { params }: { params: Promise<{ brandId: string }> }) {
  const { brandId } = await params;
  return jsonOk(await listApplicableBrandRules({ prisma, brandId }));
}

export async function POST(request: Request, { params }: { params: Promise<{ brandId: string }> }) {
  try {
    const { brandId } = await params;
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
    if (error instanceof Error) return jsonError(error.message, 400);
    return jsonErrorFromUnknown(error, "Could not create brand rule.", 500);
  }
}
