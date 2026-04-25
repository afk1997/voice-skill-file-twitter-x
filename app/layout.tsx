import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Voice Skill File for Twitter/X",
  description: "Upload past writing. Build a reusable voice file. Generate tweets that sound like you.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header className="border-b border-line bg-white">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
            <Link href="/" className="text-sm font-semibold tracking-normal text-ink">
              Voice Skill File
            </Link>
            <nav className="flex items-center gap-4 text-sm text-muted">
              <Link href="/settings" className="hover:text-ink">
                Settings
              </Link>
              <Link href="/brands/new" className="rounded-ui bg-ink px-3 py-2 text-white hover:bg-black">
                New brand
              </Link>
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
      </body>
    </html>
  );
}
