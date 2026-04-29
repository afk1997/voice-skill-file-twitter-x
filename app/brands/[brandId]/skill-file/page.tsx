import Link from "next/link";
import { notFound } from "next/navigation";
import { SkillFileEditor } from "@/components/skill-file/SkillFileEditor";
import { PageHeader } from "@/components/ui/PageHeader";
import { prisma } from "@/lib/db";
import { parseJsonField } from "@/lib/request";
import type { VoiceSkillFile } from "@/lib/types";
import { diffSkillFiles } from "@/lib/voice/skillFileDiff";
import { getSkillFileHealth } from "@/lib/voice/skillFileHealth";

export const dynamic = "force-dynamic";

export default async function SkillFilePage({ params }: { params: Promise<{ brandId: string }> }) {
  const { brandId } = await params;
  const brand = await prisma.brand.findUnique({
    where: { id: brandId },
    include: { skillFiles: { orderBy: { createdAt: "desc" }, take: 2 } },
  });
  if (!brand) notFound();

  const latest = brand.skillFiles[0];
  const previous = brand.skillFiles[1];
  const skillFile = latest ? parseJsonField<VoiceSkillFile | null>(latest.skillJson, null) : null;
  const previousSkillFile = previous ? parseJsonField<VoiceSkillFile | null>(previous.skillJson, null) : null;
  const versionDiff = skillFile && previousSkillFile ? diffSkillFiles({ previous: previousSkillFile, current: skillFile }) : null;
  const usefulSampleCount = await prisma.contentSample.count({ where: { brandId, usedForVoice: true } });
  const skillHealth = getSkillFileHealth({
    skillFile,
    usefulSampleCount,
    skillCreatedAt: latest?.createdAt,
  });

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow={brand.name}
        title="Skill File"
        description="The reusable JSON voice artifact. Saving edits creates a new version."
        actions={
          <Link href={`/brands/${brand.id}`} className="spool-button-secondary text-sm">
            Brand dashboard
          </Link>
        }
      />

      {skillFile ? (
        <div className="space-y-3">
          <div className="flex flex-col gap-3 rounded-ui border border-line bg-panel p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm text-muted">Latest version: <span className="font-medium text-ink">{skillFile.version}</span></p>
              <p className="mt-1 text-sm text-muted">
                Voice health: <span className="font-medium text-ink">{skillHealth.label}</span> · {skillHealth.corpusSampleCount.toLocaleString()} corpus samples
              </p>
            </div>
            <Link href={`/brands/${brand.id}/studio`} className="rounded-ui bg-ink px-4 py-2 text-center text-sm font-medium text-white">
              Open Tweet Studio
            </Link>
          </div>
          <SkillFileEditor brandId={brand.id} skillFile={skillFile} versionDiff={versionDiff} />
        </div>
      ) : (
        <div className="spool-plate p-5">
          <h2 className="font-semibold text-ink">No skill file yet</h2>
          <p className="mt-2 text-sm text-muted">Upload samples and analyze the brand voice to create the first Voice Skill File.</p>
          <Link href={`/brands/${brand.id}/voice-report`} className="mt-4 inline-flex rounded-ui bg-ink px-4 py-2 text-sm font-medium text-white">
            Analyze voice
          </Link>
        </div>
      )}
    </div>
  );
}
