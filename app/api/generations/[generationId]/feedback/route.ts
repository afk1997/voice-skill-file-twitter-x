import { FEEDBACK_LABELS } from "@/lib/constants";
import { prisma } from "@/lib/db";
import { jsonError, jsonOk, parseJsonField, stringifyJsonField } from "@/lib/request";
import type { VoiceSkillFile } from "@/lib/types";
import { updateSkillFileFromFeedback } from "@/lib/voice/updateSkillFileFromFeedback";
import { nextSkillVersion } from "@/lib/voice/versioning";

export async function POST(request: Request, { params }: { params: Promise<{ generationId: string }> }) {
  const { generationId } = await params;
  const body = await request.json();

  if (!FEEDBACK_LABELS.includes(body.label)) {
    return jsonError("Feedback label is not supported.", 400);
  }

  const generation = await prisma.generation.findUnique({
    where: { id: generationId },
  });

  if (!generation) return jsonError("Generation not found.", 404);

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
  const updated = updateSkillFileFromFeedback({
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

  return jsonOk({ feedback, skillFile: { ...skillFile, skillJson: updated } });
}
