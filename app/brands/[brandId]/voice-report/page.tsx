import Link from "next/link";
import { notFound } from "next/navigation";
import { AnalyzeVoicePanel } from "@/components/voice-report/AnalyzeVoicePanel";
import { prisma } from "@/lib/db";
import { parseJsonField } from "@/lib/request";
import type { VoiceReport } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function VoiceReportPage({ params }: { params: Promise<{ brandId: string }> }) {
  const { brandId } = await params;
  const brand = await prisma.brand.findUnique({
    where: { id: brandId },
    include: { voiceReports: { orderBy: { createdAt: "desc" }, take: 1 } },
  });
  if (!brand) notFound();

  const initialReport = brand.voiceReports[0] ? parseJsonField<VoiceReport | null>(brand.voiceReports[0].reportJson, null) : null;

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between gap-4 border-b border-line pb-6">
        <div>
          <p className="text-sm font-medium text-accent">{brand.name}</p>
          <h1 className="mt-2 text-3xl font-semibold text-ink">Voice Report</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">Turn useful writing samples into a structured report and a reusable Voice Skill File.</p>
        </div>
        <Link href={`/brands/${brand.id}`} className="text-sm text-muted hover:text-ink">
          Brand dashboard
        </Link>
      </div>
      <AnalyzeVoicePanel brandId={brand.id} initialReport={initialReport} />
    </div>
  );
}
