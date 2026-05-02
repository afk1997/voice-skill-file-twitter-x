import { describe, expect, it, vi } from "vitest";
import { AuthRequiredError } from "@/lib/auth/errors";
import { ensureCurrentUserProfileForPageFromSources, ensureCurrentUserProfileFromSources, serializeProfile } from "@/lib/auth/currentUserProfile";

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

  it("redirects anonymous page routes before reading Clerk user data", async () => {
    const readCurrentUser = vi.fn();
    const redirectToSignIn = vi.fn(() => {
      throw new Error("redirected");
    });

    await expect(
      ensureCurrentUserProfileForPageFromSources({
        prisma: { userProfile: { upsert: vi.fn() } },
        readAuth: async () => ({ userId: null }),
        readCurrentUser,
        redirectToSignIn,
      } as never),
    ).rejects.toThrow("redirected");

    expect(redirectToSignIn).toHaveBeenCalledOnce();
    expect(readCurrentUser).not.toHaveBeenCalled();
  });

  it("upserts page profiles after auth is present", async () => {
    const calls: string[] = [];
    const upsert = vi.fn().mockImplementation(() => {
      calls.push("upsert");
      return Promise.resolve({
        id: "profile1",
        clerkUserId: "user_123",
        email: "kaivan@example.com",
        displayName: "Kaivan",
        imageUrl: null,
        bio: null,
        defaultBrandId: null,
      });
    });

    const profile = await ensureCurrentUserProfileForPageFromSources({
      prisma: { userProfile: { upsert } },
      readAuth: async () => {
        calls.push("auth");
        return { userId: "user_123" };
      },
      readCurrentUser: async () => ({
        id: "user_123",
        fullName: "Kaivan",
        imageUrl: null,
        primaryEmailAddress: { emailAddress: "kaivan@example.com" },
      }),
      redirectToSignIn: () => {
        throw new Error("should not redirect");
      },
    } as never);

    expect(calls).toEqual(["auth", "upsert"]);
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
