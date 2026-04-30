import { claimLegacyBrands } from "@/lib/auth/brandAccess";
import { authErrorStatus } from "@/lib/auth/errors";
import { ensureCurrentUserProfile } from "@/lib/auth/currentUserProfile";
import { jsonError, jsonErrorFromUnknown, jsonOk } from "@/lib/request";

export async function POST() {
  try {
    const profile = await ensureCurrentUserProfile();
    return jsonOk(await claimLegacyBrands({ profileId: profile.id }));
  } catch (error) {
    if (error instanceof Error) return jsonError(error.message, authErrorStatus(error));
    return jsonErrorFromUnknown(error, "Could not claim legacy brands.", 500);
  }
}
