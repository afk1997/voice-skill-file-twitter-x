import { auth, currentUser } from "@clerk/nextjs/server";
import type { UserProfile } from "@prisma/client";
import { redirect } from "next/navigation";
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

function upsertProfileForUser(client: PrismaLike, userId: string, user: ClerkUserLike | null) {
  const fields = profileFieldsFromUser(userId, user);

  return client.userProfile.upsert({
    where: { clerkUserId: userId },
    update: {
      email: fields.email,
      displayName: fields.displayName,
      imageUrl: fields.imageUrl,
    },
    create: fields,
  });
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
  return upsertProfileForUser(client, session.userId, user);
}

export async function ensureCurrentUserProfileForPageFromSources({
  prisma: client,
  readAuth,
  readCurrentUser,
  redirectToSignIn,
}: {
  prisma: PrismaLike;
  readAuth: () => Promise<AuthResult>;
  readCurrentUser: () => Promise<ClerkUserLike | null>;
  redirectToSignIn: () => never;
}) {
  const session = await readAuth();
  const userId = session.userId;
  if (!userId) {
    redirectToSignIn();
    throw new AuthRequiredError();
  }

  const user = await readCurrentUser();

  return upsertProfileForUser(client, userId, user);
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

export async function ensureCurrentUserProfileForPage() {
  return ensureCurrentUserProfileForPageFromSources({
    prisma,
    readAuth: async () => {
      const session = await auth();
      return { userId: session.userId };
    },
    readCurrentUser: currentUser,
    redirectToSignIn: () => redirect("/sign-in"),
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
