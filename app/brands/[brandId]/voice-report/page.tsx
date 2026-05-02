import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import { AnalyzeVoicePanel } from "@/components/voice-report/AnalyzeVoicePanel";
import { assertBrandAccess } from "@/lib/auth/brandAccess";
import { BrandAccessError } from "@/lib/auth/errors";
import { ensureCurrentUserProfileForPage } from "@/lib/auth/currentUserProfile";
import { prisma } from "@/lib/db";
import { parseJsonField } from "@/lib/request";
import type { VoiceReport } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function VoiceReportPage({ params }: { params: Promise<{ brandId: string }> }) {
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
    include: { voiceReports: { orderBy: { createdAt: "desc" }, take: 1 } },
  });
  if (!brand) notFound();

  const initialReport = brand.voiceReports[0] ? parseJsonField<VoiceReport | null>(brand.voiceReports[0].reportJson, null) : null;

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow={brand.name}
        title="Voice Report"
        description="Turn useful writing samples into a structured report and reusable Skill File."
        actions={
          <Link href={`/brands/${brand.id}`} className="spool-button-secondary text-sm">
            Brand dashboard
          </Link>
        }
      />
      <AnalyzeVoicePanel brandId={brand.id} initialReport={initialReport} />
    </div>
  );
}
