import type { Metadata } from "next";
import Link from "next/link";
import { SpoolWordmark } from "@/components/ui/SpoolWordmark";
import "./globals.css";

export const metadata: Metadata = {
  title: "Spool",
  description: "Build a reusable voice engine for posts, threads, and launches.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header className="border-b-[1.5px] border-ink bg-paper/95">
          <div className="mx-auto flex max-w-6xl flex-col gap-3 px-5 py-4 md:flex-row md:items-center md:justify-between md:px-6">
            <Link href="/" aria-label="Spool home">
              <SpoolWordmark className="text-3xl" />
            </Link>
            <nav className="flex flex-wrap items-center gap-2 font-mono text-[10px] font-semibold uppercase tracking-normal text-ink md:gap-3">
              <Link href="/settings" className="hover:text-accentText">
                Provider Settings
              </Link>
              <Link href="/brands/new" className="spool-button min-h-9 px-3 py-2 font-sans text-xs normal-case tracking-normal">
                New brand
              </Link>
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-5 py-8 md:px-6">{children}</main>
      </body>
    </html>
  );
}
