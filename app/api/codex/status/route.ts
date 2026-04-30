import { authErrorStatus } from "@/lib/auth/errors";
import { ensureCurrentUserProfile } from "@/lib/auth/currentUserProfile";
import { readCodexStatus } from "@/lib/codex/appServer";
import { jsonError, jsonErrorFromUnknown, jsonOk } from "@/lib/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await ensureCurrentUserProfile();
    return jsonOk(await readCodexStatus());
  } catch (error) {
    if (error instanceof Error && authErrorStatus(error) !== 500) return jsonError(error.message, authErrorStatus(error));
    return jsonErrorFromUnknown(error, "Could not read Codex Local status.", 502);
  }
}
