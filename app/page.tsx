import Link from "next/link";
import { prisma } from "@/lib/db";
import { SpoolWordmark } from "@/components/ui/SpoolWordmark";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const brands = await prisma.brand.findMany({
    orderBy: { updatedAt: "desc" },
    include: {
      _count: { select: { contentSamples: true, skillFiles: true } },
      skillFiles: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  });

  return (
    <div className="space-y-8">
      <section className="spool-rule pb-8 pt-6">
        <p className="spool-stamp">Posts / threads / launches</p>
        <h1 className="mt-7 max-w-4xl font-display text-6xl font-semibold leading-[0.88] tracking-normal text-ink md:text-8xl">
          <SpoolWordmark />
        </h1>
        <p className="mt-6 max-w-2xl font-display text-2xl italic leading-tight text-ink md:text-3xl">
          Build a reusable voice engine from real writing.
        </p>
        <p className="mt-4 max-w-2xl text-base leading-7 text-muted">
          Upload past social writing, turn it into a Skill File, and draft posts that stay close to the voice.
        </p>
        <Link href="/brands/new" className="spool-button mt-6">
          Create Brand Voice Workspace
        </Link>
      </section>
      <section>
        <h2 className="text-xl font-semibold text-ink">Brand workspaces</h2>
        {brands.length === 0 ? (
          <p className="mt-2 text-sm text-muted">No workspaces yet. Create one to start building a Voice Skill File.</p>
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
