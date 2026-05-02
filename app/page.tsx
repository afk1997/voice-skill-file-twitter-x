import Link from "next/link";
import React from "react";
import { ClaimLegacyBrandsPanel } from "@/components/profile/ClaimLegacyBrandsPanel";
import { findUnownedBrands } from "@/lib/auth/brandAccess";
import { currentUserProfileOrNull } from "@/lib/auth/currentUserProfile";
import { listBrandWorkspaces } from "@/lib/brands/listBrandWorkspaces";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const profile = await currentUserProfileOrNull();
  const [{ brands, loadError }, unownedBrands] = profile
    ? await Promise.all([listBrandWorkspaces(profile.id), findUnownedBrands()])
    : [{ brands: [], loadError: null }, []];

  return (
    <div className="space-y-8">
      <section className="pb-2 pt-6">
        <p className="spool-stamp">Content / voice / agents</p>
        <h1 className="mt-7 max-w-4xl font-display text-5xl font-semibold leading-[0.92] tracking-normal text-ink md:text-7xl">
          Build a reusable voice engine from real writing.
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-7 text-muted">
          Turn real writing into a Skill File your agents can use to draft posts, threads, and replies in the right voice.
        </p>
        <Link href={profile ? "/brands/new" : "/sign-in"} className="spool-button mt-6">
          {profile ? "Create Brand Voice Workspace" : "Sign in to start"}
        </Link>
      </section>
      {unownedBrands.length ? <ClaimLegacyBrandsPanel brands={unownedBrands} /> : null}
      {profile ? (
        <section>
          <h2 className="text-xl font-semibold text-ink">Brand workspaces</h2>
          {loadError ? (
            <p className="mt-2 max-w-xl text-sm text-muted">{loadError}</p>
          ) : brands.length === 0 ? (
            <p className="mt-2 text-sm text-muted">No workspaces yet. Create one to start building a Skill File.</p>
          ) : (
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {brands.map((brand) => (
                <Link key={brand.id} href={`/brands/${brand.id}`} className="spool-plate p-4 transition-colors hover:border-accentText">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-semibold text-ink">{brand.name}</h3>
                      <p className="mt-1 text-sm text-muted">{brand.twitterHandle || brand.category || "Brand voice workspace"}</p>
                    </div>
                    <span className="border-[1.5px] border-ink bg-paper px-2 py-1 font-mono text-[10px] font-semibold uppercase tracking-normal text-muted">
                      {brand.skillFiles[0]?.version || "No skill file"}
                    </span>
                  </div>
                  <p className="mt-3 text-sm text-muted">
                    {brand._count.contentSamples} samples stored / {brand._count.skillFiles} skill versions
                  </p>
                </Link>
              ))}
            </div>
          )}
        </section>
      ) : (
        <section className="spool-plate p-5">
          <h2 className="text-xl font-semibold text-ink">Brand workspaces</h2>
          <p className="mt-2 max-w-xl text-sm leading-6 text-muted">
            Sign in to view your workspaces, claim any legacy brands, and build Skill Files from your writing samples.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link href="/sign-in" className="spool-button-secondary text-sm">
              Sign in
            </Link>
            <Link href="/sign-up" className="spool-button text-sm">
              Create account
            </Link>
          </div>
        </section>
      )}
    </div>
  );
}
