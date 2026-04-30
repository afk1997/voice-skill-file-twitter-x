import { authErrorStatus } from "@/lib/auth/errors";
import { ensureCurrentUserProfile } from "@/lib/auth/currentUserProfile";
import { logoutCodex } from "@/lib/codex/appServer";
import { jsonError, jsonErrorFromUnknown, jsonOk } from "@/lib/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  try {
    await ensureCurrentUserProfile();
    await logoutCodex();
    return jsonOk({ ok: true });
  } catch (error) {
    if (error instanceof Error && authErrorStatus(error) !== 500) return jsonError(error.message, authErrorStatus(error));
    return jsonErrorFromUnknown(error, "Could not log out of Codex Local.", 502);
  }
}
