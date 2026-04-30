import { auth, currentUser } from "@clerk/nextjs/server";
import type { UserProfile } from "@prisma/client";
import { AuthRequiredError } from "@/lib/auth/errors";
import { prisma } from "@/lib/db";

type PrismaLike = Record<string, any>;

type AuthResult = {
  userId: string | null;
};

type ClerkUserLike = {
  id: string;
  fullName?: string | null;
  imageUrl?: string | null;
  primaryEmailAddress?: { emailAddress?: string | null } | null;
};

function profileFieldsFromUser(userId: string, user: ClerkUserLike | null) {
  return {
    clerkUserId: userId,
    email: user?.primaryEmailAddress?.emailAddress ?? null,
    displayName: user?.fullName ?? null,
    imageUrl: user?.imageUrl ?? null,
  };
}

export async function ensureCurrentUserProfileFromSources({
  prisma: client,
  readAuth,
  readCurrentUser,
}: {
  prisma: PrismaLike;
  readAuth: () => Promise<AuthResult>;
  readCurrentUser: () => Promise<ClerkUserLike | null>;
}) {
  const session = await readAuth();
  if (!session.userId) throw new AuthRequiredError();

  const user = await readCurrentUser();
  const fields = profileFieldsFromUser(session.userId, user);

  return client.userProfile.upsert({
    where: { clerkUserId: session.userId },
    update: {
      email: fields.email,
      displayName: fields.displayName,
      imageUrl: fields.imageUrl,
    },
    create: fields,
  });
}

export async function ensureCurrentUserProfile() {
  return ensureCurrentUserProfileFromSources({
    prisma,
    readAuth: async () => {
      const session = await auth();
      return { userId: session.userId };
    },
    readCurrentUser: currentUser,
  });
}

export async function currentUserProfileOrNull() {
  try {
    return await ensureCurrentUserProfile();
  } catch (error) {
    if (error instanceof AuthRequiredError) return null;
    throw error;
  }
}

export function serializeProfile(profile: UserProfile) {
  return {
    id: profile.id,
    clerkUserId: profile.clerkUserId,
    email: profile.email ?? "",
    displayName: profile.displayName ?? "",
    imageUrl: profile.imageUrl ?? "",
    bio: profile.bio ?? "",
    defaultBrandId: profile.defaultBrandId ?? "",
    createdAt: profile.createdAt.toISOString(),
    updatedAt: profile.updatedAt.toISOString(),
  };
}
