import { authErrorStatus } from "@/lib/auth/errors";
import { ensureCurrentUserProfile } from "@/lib/auth/currentUserProfile";
import { startCodexDeviceLogin } from "@/lib/codex/appServer";
import { jsonError, jsonErrorFromUnknown, jsonOk } from "@/lib/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  try {
    await ensureCurrentUserProfile();
    return jsonOk(await startCodexDeviceLogin());
  } catch (error) {
    if (error instanceof Error && authErrorStatus(error) !== 500) return jsonError(error.message, authErrorStatus(error));
    return jsonErrorFromUnknown(error, "Could not start Codex Local login.", 502);
  }
}
