import { logoutCodex } from "@/lib/codex/appServer";
import { jsonErrorFromUnknown, jsonOk } from "@/lib/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  try {
    await logoutCodex();
    return jsonOk({ ok: true });
  } catch (error) {
    return jsonErrorFromUnknown(error, "Could not log out of Codex Local.", 502);
  }
}
