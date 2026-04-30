import { createBrandForProfile } from "@/lib/auth/brandAccess";
import { authErrorStatus } from "@/lib/auth/errors";
import { ensureCurrentUserProfile } from "@/lib/auth/currentUserProfile";
import { listBrandWorkspaces } from "@/lib/brands/listBrandWorkspaces";
import { jsonError, jsonErrorFromUnknown, jsonOk } from "@/lib/request";

export async function GET() {
  try {
    const profile = await ensureCurrentUserProfile();
    return jsonOk(await listBrandWorkspaces(profile.id));
  } catch (error) {
    if (error instanceof Error) return jsonError(error.message, authErrorStatus(error));
    return jsonErrorFromUnknown(error, "Could not load brands.", 500);
  }
}

export async function POST(request: Request) {
  try {
    const profile = await ensureCurrentUserProfile();
    const body = await request.json();
    if (!body.name || typeof body.name !== "string") {
      return jsonError("Brand name is required.", 400);
    }

    const brand = await createBrandForProfile({
      profileId: profile.id,
      input: {
        name: body.name,
        twitterHandle: body.twitterHandle || null,
        website: body.website || null,
        category: body.category || null,
        audience: body.audience || null,
        description: body.description || null,
        beliefs: body.beliefs || null,
        avoidSoundingLike: body.avoidSoundingLike || null,
      },
    });

    return jsonOk({ brand }, { status: 201 });
  } catch (error) {
    if (error instanceof Error) return jsonError(error.message, authErrorStatus(error));
    return jsonErrorFromUnknown(error, "Could not create brand.", 500);
  }
}
