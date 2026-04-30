// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ClaimLegacyBrandsPanel } from "@/components/profile/ClaimLegacyBrandsPanel";
import { ProfileForm } from "@/components/profile/ProfileForm";

const routerBridge = vi.hoisted(() => ({
  refresh: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => routerBridge,
}));

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  routerBridge.refresh.mockReset();
});

describe("profile components", () => {
  it("submits changed profile fields", async () => {
    const fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ profile: { displayName: "Kai", bio: "Builder" } }) });
    vi.stubGlobal("fetch", fetch);

    render(<ProfileForm profile={{ displayName: "", bio: "" }} />);

    fireEvent.change(screen.getByLabelText("Display name"), { target: { value: "Kai" } });
    fireEvent.change(screen.getByLabelText("Bio"), { target: { value: "Builder" } });
    fireEvent.click(screen.getByRole("button", { name: "Save profile" }));

    await waitFor(() => expect(fetch).toHaveBeenCalledWith("/api/profile", expect.objectContaining({ method: "PATCH" })));
  });

  it("claims legacy brands", async () => {
    const fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ claimedCount: 2 }) });
    vi.stubGlobal("fetch", fetch);

    render(<ClaimLegacyBrandsPanel brands={[{ id: "b1", name: "Acme" }, { id: "b2", name: "Beta" }]} />);

    fireEvent.click(screen.getByRole("button", { name: "Claim existing workspaces" }));

    await waitFor(() => expect(fetch).toHaveBeenCalledWith("/api/profile/claim-legacy-brands", { method: "POST" }));
    expect(await screen.findByText("Claimed 2 workspaces.")).toBeTruthy();
    expect(routerBridge.refresh).toHaveBeenCalledOnce();
  });
});
