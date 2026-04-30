// @vitest-environment jsdom
import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AppHeader } from "@/components/auth/AppHeader";

vi.mock("@clerk/nextjs", () => ({
  Show: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SignInButton: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SignUpButton: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  UserButton: () => <button aria-label="User menu">User</button>,
}));

afterEach(() => cleanup());

describe("AppHeader", () => {
  it("renders navigation for signed-in users and auth actions for signed-out users", () => {
    render(<AppHeader />);

    expect(screen.getByText("Provider Settings")).toBeTruthy();
    expect(screen.getByText("New brand")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Sign in" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Sign up" })).toBeTruthy();
    expect(screen.getByLabelText("User menu")).toBeTruthy();
  });
});
