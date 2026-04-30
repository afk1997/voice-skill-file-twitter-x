import { FEEDBACK_LABELS } from "@/lib/constants";
import { assertBrandAccess } from "@/lib/auth/brandAccess";
import { authErrorStatus } from "@/lib/auth/errors";
import { ensureCurrentUserProfile } from "@/lib/auth/currentUserProfile";
import { prisma } from "@/lib/db";
import { jsonError, jsonErrorFromUnknown, jsonOk, parseJsonField, stringifyJsonField } from "@/lib/request";
import type { VoiceSkillFile } from "@/lib/types";
import { feedbackOutcome } from "@/lib/voice/feedbackOutcome";
import { previewSkillFileFeedbackUpdate, updateSkillFileFromFeedbackWithSummary } from "@/lib/voice/updateSkillFileFromFeedback";
import { nextSkillVersion } from "@/lib/voice/versioning";

export async function POST(request: Request, { params }: { params: Promise<{ generationId: string }> }) {
  try {
    const { generationId } = await params;
    const profile = await ensureCurrentUserProfile();
    const body = await request.json();

    if (!FEEDBACK_LABELS.includes(body.label)) {
      return jsonError("Feedback label is not supported.", 400);
    }

    const generation = await prisma.generation.findUnique({
      where: { id: generationId },
    });

    if (!generation) return jsonError("Generation not found.", 404);
    await assertBrandAccess({ profileId: profile.id, brandId: generation.brandId });

    const latestSkillFile = await prisma.skillFile.findFirst({
      where: { brandId: generation.brandId },
      orderBy: { createdAt: "desc" },
    });

    if (!latestSkillFile) return jsonError("Skill file not found.", 404);

    const currentSkillFile = parseJsonField<VoiceSkillFile | null>(latestSkillFile.skillJson, null);
    if (!currentSkillFile) return jsonError("Latest skill file could not be parsed.", 500);

    const feedback = await prisma.feedback.create({
      data: {
        generationId,
        label: body.label,
        comment: body.comment || null,
      },
    });

    const version = nextSkillVersion(latestSkillFile.version);

    if (body.preview === true) {
      const preview = previewSkillFileFeedbackUpdate({
        skillFile: currentSkillFile,
        nextVersion: version,
        generatedText: generation.outputText,
        label: body.label,
        comment: body.comment || null,
      });

      return jsonOk({
        outcome: feedbackOutcome(body.label),
        changes: preview.changes,
        preview: {
          version,
          items: preview.items,
        },
        skillFile: { brandId: generation.brandId, version, skillJson: preview.updatedSkillFile },
      });
    }

    const { skillFile: updated, changes } = updateSkillFileFromFeedbackWithSummary({
      skillFile: currentSkillFile,
      nextVersion: version,
      generatedText: generation.outputText,
      label: body.label,
      comment: body.comment || null,
    });

    const skillFile = await prisma.skillFile.create({
      data: {
        brandId: generation.brandId,
        version,
        skillJson: stringifyJsonField(updated),
      },
    });

    return jsonOk({ feedback, outcome: feedbackOutcome(body.label), changes, skillFile: { ...skillFile, skillJson: updated } });
  } catch (error) {
    if (error instanceof Error && authErrorStatus(error) !== 500) return jsonError(error.message, authErrorStatus(error));
    return jsonErrorFromUnknown(error, "Could not save feedback.", 500);
  }
}
