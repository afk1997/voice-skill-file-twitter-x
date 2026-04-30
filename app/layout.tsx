import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { AppHeader } from "@/components/auth/AppHeader";
import "./globals.css";

export const metadata: Metadata = {
  title: "Spool",
  description: "Turn real writing into Skill Files for agent-ready drafts.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider>
      <html lang="en">
        <body>
          <AppHeader />
          <main className="mx-auto max-w-6xl px-5 py-8 md:px-6">{children}</main>
        </body>
      </html>
    </ClerkProvider>
  );
}
