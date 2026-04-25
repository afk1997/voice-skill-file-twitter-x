import Link from "next/link";
import { prisma } from "@/lib/db";

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
      <section className="border-b border-line pb-8">
        <p className="text-sm font-medium text-accent">Twitter/X brand voice replication</p>
        <h1 className="mt-3 max-w-3xl text-4xl font-semibold tracking-normal text-ink">
          Upload your past writing. Get a reusable Voice Skill File. Generate tweets that sound like you.
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-7 text-muted">
          This local MVP turns archive samples into a structured voice file, then uses it to draft and refine Twitter-native posts.
        </p>
        <Link href="/brands/new" className="mt-6 inline-flex rounded-ui bg-ink px-4 py-2 text-sm font-medium text-white hover:bg-black">
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
              <Link key={brand.id} href={`/brands/${brand.id}`} className="rounded-ui border border-line bg-white p-4 hover:border-ink">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-semibold text-ink">{brand.name}</h3>
                    <p className="mt-1 text-sm text-muted">{brand.twitterHandle || brand.category || "Brand voice workspace"}</p>
                  </div>
                  <span className="rounded-ui bg-panel px-2 py-1 text-xs text-muted">{brand.skillFiles[0]?.version || "No skill file"}</span>
                </div>
                <p className="mt-3 text-sm text-muted">
                  {brand._count.contentSamples} samples stored · {brand._count.skillFiles} skill versions
                </p>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
