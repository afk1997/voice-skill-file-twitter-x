import Link from "next/link";
import { notFound } from "next/navigation";
import { SkillFileEditor } from "@/components/skill-file/SkillFileEditor";
import { prisma } from "@/lib/db";
import { parseJsonField } from "@/lib/request";
import type { VoiceSkillFile } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function SkillFilePage({ params }: { params: Promise<{ brandId: string }> }) {
  const { brandId } = await params;
  const brand = await prisma.brand.findUnique({
    where: { id: brandId },
    include: { skillFiles: { orderBy: { createdAt: "desc" }, take: 1 } },
  });
  if (!brand) notFound();

  const latest = brand.skillFiles[0];
  const skillFile = latest ? parseJsonField<VoiceSkillFile | null>(latest.skillJson, null) : null;

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between gap-4 border-b border-line pb-6">
        <div>
          <p className="text-sm font-medium text-accent">{brand.name}</p>
          <h1 className="mt-2 text-3xl font-semibold text-ink">Voice Skill File</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">The reusable JSON voice artifact. Saving edits creates a new version.</p>
        </div>
        <Link href={`/brands/${brand.id}`} className="text-sm text-muted hover:text-ink">
          Brand dashboard
        </Link>
      </div>

      {skillFile ? (
        <div className="space-y-3">
          <div className="flex flex-col gap-3 rounded-ui border border-line bg-panel p-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted">Latest version: <span className="font-medium text-ink">{skillFile.version}</span></p>
            <Link href={`/brands/${brand.id}/studio`} className="rounded-ui bg-ink px-4 py-2 text-center text-sm font-medium text-white">
              Open Tweet Studio
            </Link>
          </div>
          <SkillFileEditor brandId={brand.id} skillFile={skillFile} />
        </div>
      ) : (
        <div className="rounded-ui border border-line bg-panel p-5">
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
