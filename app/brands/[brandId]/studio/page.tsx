import Link from "next/link";
import { notFound } from "next/navigation";
import { TweetStudio } from "@/components/studio/TweetStudio";
import { prisma } from "@/lib/db";
import { parseJsonField } from "@/lib/request";
import type { VoiceSkillFile } from "@/lib/types";
import { getSkillFileHealth } from "@/lib/voice/skillFileHealth";

export const dynamic = "force-dynamic";

export default async function StudioPage({ params }: { params: Promise<{ brandId: string }> }) {
  const { brandId } = await params;
  const brand = await prisma.brand.findUnique({
    where: { id: brandId },
    include: { skillFiles: { orderBy: { createdAt: "desc" }, take: 1 } },
  });
  if (!brand) notFound();
  const usefulSampleCount = await prisma.contentSample.count({ where: { brandId, usedForVoice: true } });
  const latestSkill = brand.skillFiles[0];
  const skillFile = latestSkill ? parseJsonField<VoiceSkillFile | null>(latestSkill.skillJson, null) : null;
  const skillHealth = getSkillFileHealth({
    skillFile,
    usefulSampleCount,
    skillCreatedAt: latestSkill?.createdAt,
  });

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between gap-4 border-b border-line pb-6">
        <div>
          <p className="text-sm font-medium text-accent">{brand.name}</p>
          <h1 className="mt-2 text-3xl font-semibold text-ink">Tweet Studio</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">Generate Twitter/X drafts from the latest Voice Skill File and improve it with feedback.</p>
        </div>
        <Link href={`/brands/${brand.id}`} className="text-sm text-muted hover:text-ink">
          Brand dashboard
        </Link>
      </div>

      {latestSkill ? (
        <TweetStudio brandId={brand.id} skillHealth={skillHealth} skillFileVersion={skillFile?.version || latestSkill.version} />
      ) : (
        <div className="rounded-ui border border-line bg-panel p-5">
          <h2 className="font-semibold text-ink">No skill file yet</h2>
          <p className="mt-2 text-sm text-muted">Analyze voice before generating brand-matched tweets.</p>
          <Link href={`/brands/${brand.id}/voice-report`} className="mt-4 inline-flex rounded-ui bg-ink px-4 py-2 text-sm font-medium text-white">
            Analyze voice
          </Link>
        </div>
      )}
    </div>
  );
}
