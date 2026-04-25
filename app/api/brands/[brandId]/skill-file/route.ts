import { prisma } from "@/lib/db";
import { jsonError, jsonOk, parseJsonField, stringifyJsonField } from "@/lib/request";
import type { VoiceSkillFile } from "@/lib/types";
import { nextSkillVersion } from "@/lib/voice/versioning";

function hasRequiredSkillShape(value: unknown): value is VoiceSkillFile {
  if (!value || typeof value !== "object") return false;
  const skill = value as Record<string, unknown>;
  return Boolean(
    skill.brandName &&
      skill.voiceSummary &&
      skill.coreVoiceIdentity &&
      skill.toneSliders &&
      Array.isArray(skill.linguisticRules) &&
      Array.isArray(skill.contextualToneRules) &&
      skill.exampleLibrary &&
      skill.qualityRubric,
  );
}

export async function GET(_request: Request, { params }: { params: Promise<{ brandId: string }> }) {
  const { brandId } = await params;
  const skillFile = await prisma.skillFile.findFirst({
    where: { brandId },
    orderBy: { createdAt: "desc" },
  });
  if (!skillFile) return jsonError("Skill file not found.", 404);
  return jsonOk({ skillFile: { ...skillFile, skillJson: parseJsonField(skillFile.skillJson, null) } });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ brandId: string }> }) {
  const { brandId } = await params;
  const body = await request.json();
  const incoming = body.skillJson;

  if (!hasRequiredSkillShape(incoming)) {
    return jsonError("Skill file JSON is missing required top-level fields.", 400);
  }

  const latest = await prisma.skillFile.findFirst({
    where: { brandId },
    orderBy: { createdAt: "desc" },
  });

  const version = nextSkillVersion(latest?.version);
  const skillJson: VoiceSkillFile = {
    ...incoming,
    version,
    updatedAt: new Date().toISOString(),
  };

  const skillFile = await prisma.skillFile.create({
    data: { brandId, version, skillJson: stringifyJsonField(skillJson) },
  });

  return jsonOk({ skillFile: { ...skillFile, skillJson } });
}
