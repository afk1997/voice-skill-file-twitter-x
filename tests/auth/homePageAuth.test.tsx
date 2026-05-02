// @vitest-environment jsdom
import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const authBridge = vi.hoisted(() => ({
  currentUserProfileOrNull: vi.fn(),
}));

const accessBridge = vi.hoisted(() => ({
  findUnownedBrands: vi.fn(),
}));

const brandsBridge = vi.hoisted(() => ({
  listBrandWorkspaces: vi.fn(),
}));

vi.mock("@/lib/auth/currentUserProfile", () => authBridge);
vi.mock("@/lib/auth/brandAccess", () => accessBridge);
vi.mock("@/lib/brands/listBrandWorkspaces", () => brandsBridge);
vi.mock("@/components/profile/ClaimLegacyBrandsPanel", () => ({
  ClaimLegacyBrandsPanel: () => <div>Claim legacy brands</div>,
}));

afterEach(() => cleanup());

describe("HomePage auth states", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("renders a signed-out entry state without loading workspaces", async () => {
    authBridge.currentUserProfileOrNull.mockResolvedValue(null);

    const { default: HomePage } = await import("@/app/page");
    render(await HomePage());

    expect(screen.getByText("Sign in to start")).toBeTruthy();
    expect(screen.getByText("Sign in to view your workspaces, claim any legacy brands, and build Skill Files from your writing samples.")).toBeTruthy();
    expect(brandsBridge.listBrandWorkspaces).not.toHaveBeenCalled();
    expect(accessBridge.findUnownedBrands).not.toHaveBeenCalled();
  });

  it("loads scoped workspaces for signed-in users", async () => {
    authBridge.currentUserProfileOrNull.mockResolvedValue({ id: "profile1" });
    brandsBridge.listBrandWorkspaces.mockResolvedValue({
      brands: [
        {
          id: "brand1",
          name: "Acme",
          twitterHandle: "@acme",
          category: null,
          skillFiles: [{ version: "v1.0" }],
          _count: { contentSamples: 3, skillFiles: 1 },
        },
      ],
      loadError: null,
    });
    accessBridge.findUnownedBrands.mockResolvedValue([]);

    const { default: HomePage } = await import("@/app/page");
    render(await HomePage());

    expect(brandsBridge.listBrandWorkspaces).toHaveBeenCalledWith("profile1");
    expect(screen.getByText("Acme")).toBeTruthy();
    expect(screen.getByText("v1.0")).toBeTruthy();
  });
});
