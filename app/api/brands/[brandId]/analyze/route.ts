import { MAX_CORPUS_ANALYSIS_SAMPLES } from "@/lib/constants";
import { assertBrandAccess } from "@/lib/auth/brandAccess";
import { authErrorStatus } from "@/lib/auth/errors";
import { ensureCurrentUserProfile } from "@/lib/auth/currentUserProfile";
import { prisma } from "@/lib/db";
import { providerConfigFromBody, jsonError, jsonErrorFromUnknown, jsonOk, parseJsonField, stringifyJsonField } from "@/lib/request";
import type { VoiceSkillFile } from "@/lib/types";
import { analyzeVoice } from "@/lib/voice/analyzeVoice";
import { buildSkillFileFromVoiceAnalysis } from "@/lib/voice/analysisSkillFile";

export async function POST(request: Request, { params }: { params: Promise<{ brandId: string }> }) {
  try {
    const { brandId } = await params;
    const profile = await ensureCurrentUserProfile();
    await assertBrandAccess({ profileId: profile.id, brandId });
    const brand = await prisma.brand.findUnique({ where: { id: brandId } });
    if (!brand) return jsonError("Brand not found.", 404);

    const samples = await prisma.contentSample.findMany({
      where: { brandId, usedForVoice: true },
      orderBy: { qualityScore: "desc" },
      take: MAX_CORPUS_ANALYSIS_SAMPLES,
      select: { cleanedText: true, qualityScore: true, classification: true },
    });

    if (samples.length === 0) {
      return jsonError("Upload useful writing samples before analyzing voice.", 400);
    }

    const body = await request.json().catch(() => ({}));
    const providerConfig = providerConfigFromBody(body);
    const report = await analyzeVoice({
      brand,
      samples,
      providerConfig,
    });

    await prisma.voiceReportRecord.create({
      data: { brandId, reportJson: stringifyJsonField(report) },
    });

    const existingSkillFile = await prisma.skillFile.findFirst({
      where: { brandId },
      orderBy: { createdAt: "desc" },
    });

    const generatedWith = providerConfig.model || providerConfig.provider;
    const previousSkillFile = existingSkillFile ? parseJsonField<VoiceSkillFile | null>(existingSkillFile.skillJson, null) : null;
    const { version, skillFile: skillJson } = buildSkillFileFromVoiceAnalysis({
      previousVersion: existingSkillFile?.version,
      previousSkillFile,
      brand,
      report,
      samples,
      generatedWith,
    });
    const skillFile = await prisma.skillFile.create({
      data: {
        brandId,
        version,
        skillJson: stringifyJsonField(skillJson),
      },
    });

    return jsonOk({ report, skillFile: { ...skillFile, skillJson } });
  } catch (error) {
    if (error instanceof Error && authErrorStatus(error) !== 500) return jsonError(error.message, authErrorStatus(error));
    return jsonErrorFromUnknown(error, "Could not analyze voice.", 502);
  }
}
