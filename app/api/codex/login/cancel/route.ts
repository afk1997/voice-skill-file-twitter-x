import { cancelCodexLogin } from "@/lib/codex/appServer";
import { jsonError, jsonErrorFromUnknown, jsonOk } from "@/lib/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as { loginId?: unknown };
    if (typeof body.loginId !== "string" || body.loginId.length === 0) return jsonError("loginId is required.", 400);
    await cancelCodexLogin(body.loginId);
    return jsonOk({ ok: true });
  } catch (error) {
    return jsonErrorFromUnknown(error, "Could not cancel Codex Local login.", 502);
  }
}
