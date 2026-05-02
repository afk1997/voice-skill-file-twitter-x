import Link from "next/link";
import { notFound } from "next/navigation";
import { BrandRulesClient } from "@/components/rules/BrandRulesClient";
import { PageHeader } from "@/components/ui/PageHeader";
import { assertBrandAccess } from "@/lib/auth/brandAccess";
import { BrandAccessError } from "@/lib/auth/errors";
import { ensureCurrentUserProfileForPage } from "@/lib/auth/currentUserProfile";
import { prisma } from "@/lib/db";
import { listApplicableBrandRules } from "@/lib/rules/ruleBankService";

export const dynamic = "force-dynamic";

export default async function BrandRulesPage({ params }: { params: Promise<{ brandId: string }> }) {
  const { brandId } = await params;
  const profile = await ensureCurrentUserProfileForPage();
  try {
    await assertBrandAccess({ profileId: profile.id, brandId });
  } catch (error) {
    if (error instanceof BrandAccessError) notFound();
    throw error;
  }
  const brand = await prisma.brand.findUnique({ where: { id: brandId }, select: { id: true, name: true } });
  if (!brand) notFound();
  const data = await listApplicableBrandRules({ prisma, brandId, profileId: profile.id });

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow={brand.name}
        title="Rules Bank"
        description="Select reusable rules, preview the Skill File patch, then apply one hardening version."
        actions={
          <>
            <Link href={`/brands/${brand.id}/skill-file`} className="spool-button-secondary text-sm">
              Skill File
            </Link>
            <Link href={`/brands/${brand.id}`} className="spool-button-secondary text-sm">
              Brand dashboard
            </Link>
          </>
        }
      />
      <BrandRulesClient
        brandId={brand.id}
        initialRules={data.rules}
        initialSelections={data.selections}
        applications={data.applications.map((application: { id: string; status: string; baseSkillFileVersion: string; appliedAt?: Date | null; createdAt?: Date | null }) => ({
          id: application.id,
          status: application.status,
          baseSkillFileVersion: application.baseSkillFileVersion,
          appliedAt: application.appliedAt?.toISOString() ?? null,
          createdAt: application.createdAt?.toISOString() ?? null,
        }))}
        latestSkillFile={
          data.latestSkillFile
            ? {
                id: data.latestSkillFile.id,
                version: data.latestSkillFile.version,
                createdAt: data.latestSkillFile.createdAt.toISOString(),
              }
            : null
        }
      />
    </div>
  );
}
