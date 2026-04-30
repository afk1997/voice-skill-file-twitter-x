import { describe, expect, it, vi } from "vitest";
import { AuthRequiredError } from "@/lib/auth/errors";
import { ensureCurrentUserProfileFromSources, serializeProfile } from "@/lib/auth/currentUserProfile";

describe("currentUserProfile", () => {
  it("rejects anonymous users", async () => {
    await expect(
      ensureCurrentUserProfileFromSources({
        prisma: {} as never,
        readAuth: async () => ({ userId: null }),
        readCurrentUser: async () => null,
      }),
    ).rejects.toBeInstanceOf(AuthRequiredError);
  });

  it("upserts a local profile from Clerk user data", async () => {
    const upsert = vi.fn().mockResolvedValue({
      id: "profile1",
      clerkUserId: "user_123",
      email: "kaivan@example.com",
      displayName: "Kaivan",
      imageUrl: "https://img.example/avatar.png",
      bio: null,
      defaultBrandId: null,
    });

    const profile = await ensureCurrentUserProfileFromSources({
      prisma: { userProfile: { upsert } },
      readAuth: async () => ({ userId: "user_123" }),
      readCurrentUser: async () => ({
        id: "user_123",
        fullName: "Kaivan",
        imageUrl: "https://img.example/avatar.png",
        primaryEmailAddress: { emailAddress: "kaivan@example.com" },
      }),
    } as never);

    expect(upsert).toHaveBeenCalledWith({
      where: { clerkUserId: "user_123" },
      update: {
        email: "kaivan@example.com",
        displayName: "Kaivan",
        imageUrl: "https://img.example/avatar.png",
      },
      create: {
        clerkUserId: "user_123",
        email: "kaivan@example.com",
        displayName: "Kaivan",
        imageUrl: "https://img.example/avatar.png",
      },
    });
    expect(profile.id).toBe("profile1");
  });

  it("serializes profile dates and nullable fields for JSON responses", () => {
    expect(
      serializeProfile({
        id: "profile1",
        clerkUserId: "user_123",
        email: "kaivan@example.com",
        displayName: null,
        imageUrl: null,
        bio: null,
        defaultBrandId: null,
        createdAt: new Date("2026-04-30T00:00:00.000Z"),
        updatedAt: new Date("2026-04-30T00:00:01.000Z"),
      }),
    ).toMatchObject({
      id: "profile1",
      email: "kaivan@example.com",
      displayName: "",
      bio: "",
      createdAt: "2026-04-30T00:00:00.000Z",
    });
  });
});
