import { Show, SignInButton, SignUpButton, UserButton } from "@clerk/nextjs";
import Link from "next/link";
import React from "react";
import { SpoolWordmark } from "@/components/ui/SpoolWordmark";

export function AppHeader() {
  return (
    <header className="border-b-[1.5px] border-ink bg-paper/95">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-5 py-4 md:flex-row md:items-center md:justify-between md:px-6">
        <Link href="/" aria-label="Spool home">
          <SpoolWordmark className="text-3xl" />
        </Link>
        <nav className="flex flex-wrap items-center gap-2 font-mono text-[10px] font-semibold uppercase tracking-normal text-ink md:gap-3">
          <Show when="signed-in">
            <Link href="/settings" className="hover:text-accentText">
              Provider Settings
            </Link>
            <Link href="/profile" className="hover:text-accentText">
              Profile
            </Link>
            <Link href="/brands/new" className="spool-button min-h-9 px-3 py-2 font-sans text-xs normal-case tracking-normal">
              New brand
            </Link>
            <UserButton />
          </Show>
          <Show when="signed-out">
            <SignInButton mode="modal">
              <button type="button" className="spool-button-secondary min-h-9 px-3 py-2 font-sans text-xs normal-case tracking-normal">
                Sign in
              </button>
            </SignInButton>
            <SignUpButton mode="modal">
              <button type="button" className="spool-button min-h-9 px-3 py-2 font-sans text-xs normal-case tracking-normal">
                Sign up
              </button>
            </SignUpButton>
          </Show>
        </nav>
      </div>
    </header>
  );
}
