import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import { assertBrandAccess } from "@/lib/auth/brandAccess";
import { BrandAccessError } from "@/lib/auth/errors";
import { ensureCurrentUserProfileForPage } from "@/lib/auth/currentUserProfile";
import { prisma } from "@/lib/db";
import { parseJsonField } from "@/lib/request";
import type { VoiceSkillFile } from "@/lib/types";
import { getSkillFileHealth } from "@/lib/voice/skillFileHealth";

export const dynamic = "force-dynamic";

export default async function BrandDashboardPage({ params }: { params: Promise<{ brandId: string }> }) {
  const { brandId } = await params;
  const profile = await ensureCurrentUserProfileForPage();
  try {
    await assertBrandAccess({ profileId: profile.id, brandId });
  } catch (error) {
    if (error instanceof BrandAccessError) notFound();
    throw error;
  }
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
  const skillHealth = getSkillFileHealth({
    skillFile: skillJson,
    usefulSampleCount: usefulSamples,
    skillCreatedAt: latestSkill?.createdAt,
    latestUploadCreatedAt: brand.uploads[0]?.createdAt,
    latestReportCreatedAt: brand.voiceReports[0]?.createdAt,
  });
  const nextAction =
    usefulSamples === 0
      ? { href: `/brands/${brand.id}/upload`, label: "Upload Content", description: "Add past tweets or writing samples so the system can learn the voice." }
      : !brand.voiceReports[0]
        ? { href: `/brands/${brand.id}/voice-report`, label: "Analyze Voice", description: "Turn useful samples into a voice report and first Skill File." }
        : !skillJson
          ? { href: `/brands/${brand.id}/skill-file`, label: "Review Skill File", description: "Inspect the generated Skill File before drafting." }
          : skillHealth.isStale || !skillHealth.corpusBacked
            ? { href: `/brands/${brand.id}/voice-report`, label: "Refresh Skill File", description: skillHealth.description }
          : { href: `/brands/${brand.id}/studio`, label: "Open Studio", description: `Generate with Skill File ${skillJson.version}.` };
  const workflowStage = skillJson && skillHealth.corpusBacked && !skillHealth.isStale ? "Generate + Learn" : brand.voiceReports[0] ? "Skill File" : usefulSamples > 0 ? "Analyze" : "Upload";
  const actions = [
    { href: `/brands/${brand.id}/upload`, label: "Upload Content" },
    { href: `/brands/${brand.id}/voice-report`, label: "Analyze Voice" },
    { href: `/brands/${brand.id}/skill-file`, label: "View Skill File" },
    { href: `/brands/${brand.id}/rules`, label: "Rules Bank" },
    { href: `/brands/${brand.id}/studio`, label: "Open Studio" },
  ];

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow={brand.twitterHandle || brand.category || "Brand workspace"}
        title={brand.name}
        description={brand.description || "Upload past writing to build a reusable Skill File."}
        actions={
          <Link href="/" className="spool-button-secondary text-sm">
            Back to workspaces
          </Link>
        }
      />

      <section className="grid gap-3 md:grid-cols-4">
        <div className="spool-plate p-4">
          <p className="text-xs uppercase text-muted">Useful samples</p>
          <p className="mt-2 text-2xl font-semibold text-ink">{usefulSamples}</p>
        </div>
        <div className="spool-plate p-4">
          <p className="text-xs uppercase text-muted">Latest upload</p>
          <p className="mt-2 text-sm font-medium text-ink">{brand.uploads[0]?.status || "None"}</p>
        </div>
        <div className="spool-plate p-4">
          <p className="text-xs uppercase text-muted">Voice report</p>
          <p className="mt-2 text-sm font-medium text-ink">{brand.voiceReports[0] ? "Created" : "Not created"}</p>
        </div>
        <div className="spool-plate p-4">
          <p className="text-xs uppercase text-muted">Skill file</p>
          <p className="mt-2 text-sm font-medium text-ink">{skillJson?.version || latestSkill?.version || "Not created"}</p>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.25fr_1fr]">
        <div className="spool-plate-soft p-5">
          <p className="text-xs font-semibold uppercase text-muted">Current stage</p>
          <h2 className="mt-1 text-xl font-semibold text-ink">{workflowStage}</h2>
          <p className="mt-2 text-sm text-muted">{nextAction.description}</p>
          <Link href={nextAction.href} className="spool-button mt-4">
            {nextAction.label}
          </Link>
        </div>

        <div className="spool-plate p-5">
          <p className="text-xs font-semibold uppercase text-muted">Voice health</p>
          <h2 className="mt-1 text-xl font-semibold text-ink">{skillHealth.label}</h2>
          <p className="mt-2 text-sm leading-6 text-muted">{skillHealth.description}</p>
          <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-muted">Corpus samples</dt>
              <dd className="font-semibold text-ink">{skillHealth.corpusSampleCount.toLocaleString()}</dd>
            </div>
            <div>
              <dt className="text-muted">Useful samples</dt>
              <dd className="font-semibold text-ink">{skillHealth.usefulSampleCount.toLocaleString()}</dd>
            </div>
          </dl>
        </div>
      </section>

      <section>
        <h2 className="mt-6 text-xl font-semibold text-ink">All actions</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-4">
          {actions.map((action) => (
            <Link key={action.href} href={action.href} className="spool-button-secondary text-sm">
              {action.label}
            </Link>
          ))}
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <div className="spool-plate-soft p-4">
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
        <div className="spool-plate-soft p-4">
          <h2 className="font-semibold text-ink">Avoid sounding like</h2>
          <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-muted">{brand.avoidSoundingLike || "Not set"}</p>
        </div>
      </section>
    </div>
  );
}
