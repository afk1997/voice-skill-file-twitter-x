import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { parseJsonField } from "@/lib/request";
import type { VoiceSkillFile } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function BrandDashboardPage({ params }: { params: Promise<{ brandId: string }> }) {
  const { brandId } = await params;
  const brand = await prisma.brand.findUnique({
    where: { id: brandId },
    include: {
      uploads: { orderBy: { createdAt: "desc" }, take: 1 },
      voiceReports: { orderBy: { createdAt: "desc" }, take: 1 },
      skillFiles: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  });

  if (!brand) notFound();

  const usefulSamples = await prisma.contentSample.count({ where: { brandId, usedForVoice: true } });
  const latestSkill = brand.skillFiles[0];
  const skillJson = latestSkill ? parseJsonField<VoiceSkillFile | null>(latestSkill.skillJson, null) : null;
  const nextAction =
    usefulSamples === 0
      ? { href: `/brands/${brand.id}/upload`, label: "Upload Content", description: "Add past tweets or writing samples so the system can learn the voice." }
      : !brand.voiceReports[0]
        ? { href: `/brands/${brand.id}/voice-report`, label: "Analyze Voice", description: "Turn useful samples into a voice report and first Skill File." }
        : !skillJson
          ? { href: `/brands/${brand.id}/skill-file`, label: "Review Skill File", description: "Inspect the generated Voice Skill File before drafting." }
          : { href: `/brands/${brand.id}/studio`, label: "Open Tweet Studio", description: `Generate with Skill File ${skillJson.version}.` };
  const workflowStage = skillJson ? "Generate + Learn" : brand.voiceReports[0] ? "Skill File" : usefulSamples > 0 ? "Analyze" : "Upload";
  const actions = [
    { href: `/brands/${brand.id}/upload`, label: "Upload Content" },
    { href: `/brands/${brand.id}/voice-report`, label: "Analyze Voice" },
    { href: `/brands/${brand.id}/skill-file`, label: "View Skill File" },
    { href: `/brands/${brand.id}/studio`, label: "Open Tweet Studio" },
  ];

  return (
    <div className="space-y-8">
      <div className="flex flex-col justify-between gap-4 border-b border-line pb-6 md:flex-row md:items-start">
        <div>
          <p className="text-sm font-medium text-accent">{brand.twitterHandle || brand.category || "Brand workspace"}</p>
          <h1 className="mt-2 text-3xl font-semibold text-ink">{brand.name}</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-muted">{brand.description || "Upload past writing to build a reusable Voice Skill File."}</p>
        </div>
        <Link href="/" className="text-sm text-muted hover:text-ink">
          Back to workspaces
        </Link>
      </div>

      <section className="grid gap-3 md:grid-cols-4">
        <div className="rounded-ui border border-line bg-white p-4">
          <p className="text-xs uppercase text-muted">Useful samples</p>
          <p className="mt-2 text-2xl font-semibold text-ink">{usefulSamples}</p>
        </div>
        <div className="rounded-ui border border-line bg-white p-4">
          <p className="text-xs uppercase text-muted">Latest upload</p>
          <p className="mt-2 text-sm font-medium text-ink">{brand.uploads[0]?.status || "None"}</p>
        </div>
        <div className="rounded-ui border border-line bg-white p-4">
          <p className="text-xs uppercase text-muted">Voice report</p>
          <p className="mt-2 text-sm font-medium text-ink">{brand.voiceReports[0] ? "Created" : "Not created"}</p>
        </div>
        <div className="rounded-ui border border-line bg-white p-4">
          <p className="text-xs uppercase text-muted">Skill file</p>
          <p className="mt-2 text-sm font-medium text-ink">{skillJson?.version || latestSkill?.version || "Not created"}</p>
        </div>
      </section>

      <section>
        <div className="rounded-ui border border-line bg-panel p-5">
          <p className="text-xs font-semibold uppercase text-muted">Current stage</p>
          <h2 className="mt-1 text-xl font-semibold text-ink">{workflowStage}</h2>
          <p className="mt-2 text-sm text-muted">{nextAction.description}</p>
          <Link href={nextAction.href} className="mt-4 inline-flex rounded-ui bg-ink px-4 py-2 text-sm font-medium text-white">
            {nextAction.label}
          </Link>
        </div>

        <h2 className="mt-6 text-xl font-semibold text-ink">All actions</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-4">
          {actions.map((action) => (
            <Link key={action.href} href={action.href} className="rounded-ui border border-line bg-white p-4 text-sm font-medium text-ink hover:border-ink">
              {action.label}
            </Link>
          ))}
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <div className="rounded-ui border border-line bg-panel p-4">
          <h2 className="font-semibold text-ink">Brand context</h2>
          <dl className="mt-3 space-y-3 text-sm">
            <div>
              <dt className="font-medium text-ink">Audience</dt>
              <dd className="text-muted">{brand.audience || "Not set"}</dd>
            </div>
            <div>
              <dt className="font-medium text-ink">Beliefs</dt>
              <dd className="whitespace-pre-wrap text-muted">{brand.beliefs || "Not set"}</dd>
            </div>
          </dl>
        </div>
        <div className="rounded-ui border border-line bg-panel p-4">
          <h2 className="font-semibold text-ink">Avoid sounding like</h2>
          <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-muted">{brand.avoidSoundingLike || "Not set"}</p>
        </div>
      </section>
    </div>
  );
}
