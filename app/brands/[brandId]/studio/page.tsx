import Link from "next/link";
import { notFound } from "next/navigation";
import { TweetStudio } from "@/components/studio/TweetStudio";
import { PageHeader } from "@/components/ui/PageHeader";
import { assertBrandAccess } from "@/lib/auth/brandAccess";
import { BrandAccessError } from "@/lib/auth/errors";
import { ensureCurrentUserProfile } from "@/lib/auth/currentUserProfile";
import { prisma } from "@/lib/db";
import { parseJsonField } from "@/lib/request";
import type { VoiceSkillFile } from "@/lib/types";
import { getSkillFileHealth } from "@/lib/voice/skillFileHealth";

export const dynamic = "force-dynamic";

export default async function StudioPage({ params }: { params: Promise<{ brandId: string }> }) {
  const { brandId } = await params;
  const profile = await ensureCurrentUserProfile();
  try {
    await assertBrandAccess({ profileId: profile.id, brandId });
  } catch (error) {
    if (error instanceof BrandAccessError) notFound();
    throw error;
  }
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
      <PageHeader
        eyebrow={brand.name}
        title="Studio"
        description="Generate social drafts from the latest Skill File and improve it with feedback."
        actions={
          <Link href={`/brands/${brand.id}`} className="spool-button-secondary text-sm">
            Brand dashboard
          </Link>
        }
      />

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
