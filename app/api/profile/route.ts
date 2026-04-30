import { authErrorStatus } from "@/lib/auth/errors";
import { ensureCurrentUserProfile, serializeProfile } from "@/lib/auth/currentUserProfile";
import { prisma } from "@/lib/db";
import { jsonError, jsonErrorFromUnknown, jsonOk } from "@/lib/request";

export async function GET() {
  try {
    const profile = await ensureCurrentUserProfile();
    return jsonOk({ profile: serializeProfile(profile) });
  } catch (error) {
    if (error instanceof Error) return jsonError(error.message, authErrorStatus(error));
    return jsonErrorFromUnknown(error, "Could not load profile.", 500);
  }
}

export async function PATCH(request: Request) {
  try {
    const current = await ensureCurrentUserProfile();
    const body = await request.json();
    const displayName = typeof body.displayName === "string" ? body.displayName.trim() : "";
    const bio = typeof body.bio === "string" ? body.bio.trim() : "";
    if (typeof body.displayName === "string" && !displayName) return jsonError("Display name cannot be empty.", 400);

    const profile = await prisma.userProfile.update({
      where: { id: current.id },
      data: { displayName: displayName || null, bio: bio || null },
    });
    return jsonOk({ profile: serializeProfile(profile) });
  } catch (error) {
    if (error instanceof Error) return jsonError(error.message, authErrorStatus(error));
    return jsonErrorFromUnknown(error, "Could not update profile.", 500);
  }
}
