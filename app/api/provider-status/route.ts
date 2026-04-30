import { authErrorStatus } from "@/lib/auth/errors";
import { ensureCurrentUserProfile } from "@/lib/auth/currentUserProfile";
import { providerFromEnv } from "@/lib/llm/client";
import { jsonError, jsonErrorFromUnknown, jsonOk } from "@/lib/request";

export async function GET() {
  try {
    await ensureCurrentUserProfile();
    const provider = providerFromEnv();
    return jsonOk({
      hasServerProvider: Boolean(provider),
      provider,
    });
  } catch (error) {
    if (error instanceof Error && authErrorStatus(error) !== 500) return jsonError(error.message, authErrorStatus(error));
    return jsonErrorFromUnknown(error, "Could not read provider status.", 500);
  }
}
