import Link from "next/link";
import { ClaimLegacyBrandsPanel } from "@/components/profile/ClaimLegacyBrandsPanel";
import { findUnownedBrands } from "@/lib/auth/brandAccess";
import { ensureCurrentUserProfile } from "@/lib/auth/currentUserProfile";
import { listBrandWorkspaces } from "@/lib/brands/listBrandWorkspaces";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const profile = await ensureCurrentUserProfile();
  const [{ brands, loadError }, unownedBrands] = await Promise.all([listBrandWorkspaces(profile.id), findUnownedBrands()]);

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
        <Link href="/brands/new" className="spool-button mt-6">
          Create Brand Voice Workspace
        </Link>
      </section>
      {unownedBrands.length ? <ClaimLegacyBrandsPanel brands={unownedBrands} /> : null}
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
    </div>
  );
}
