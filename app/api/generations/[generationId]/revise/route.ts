import { prisma } from "@/lib/db";
import { providerConfigFromBody, jsonError, jsonErrorFromUnknown, jsonOk, parseJsonField, stringifyJsonField } from "@/lib/request";
import type { VoiceSkillFile } from "@/lib/types";
import { generateTweets } from "@/lib/voice/generateTweets";
import { buildRevisionContext } from "@/lib/voice/reviseTweet";
import { selectExamplesForGeneration } from "@/lib/voice/selectExamples";

export async function POST(request: Request, { params }: { params: Promise<{ generationId: string }> }) {
  const { generationId } = await params;
  const body = await request.json();

  const generation = await prisma.generation.findUnique({
    where: { id: generationId },
    include: { feedback: { orderBy: { createdAt: "desc" }, take: 5 } },
  });

  if (!generation) return jsonError("Generation not found.", 404);

  const latestSkillFile = await prisma.skillFile.findFirst({
    where: { brandId: generation.brandId },
    orderBy: { createdAt: "desc" },
  });

  if (!latestSkillFile) return jsonError("Skill file not found.", 404);

  const skillFile = parseJsonField<VoiceSkillFile | null>(latestSkillFile.skillJson, null);
  if (!skillFile) return jsonError("Latest skill file could not be parsed.", 500);

  const samples = await prisma.contentSample.findMany({
    where: { brandId: generation.brandId, usedForVoice: true },
    orderBy: { qualityScore: "desc" },
    take: 500,
    select: { cleanedText: true, qualityScore: true, classification: true },
  });

  const feedbackNotes = generation.feedback.map((feedback) =>
    feedback.comment ? `${feedback.label}: ${feedback.comment}` : feedback.label,
  );
  const context = buildRevisionContext({
    originalPrompt: generation.prompt,
    originalTweet: generation.outputText,
    feedbackNotes,
  });

  try {
    const selectedExamples = selectExamplesForGeneration({
      context,
      tweetType: generation.tweetType,
      skillFile,
      samples,
      limit: 10,
    });

    const [result] = await generateTweets({
      context,
      tweetType: generation.tweetType,
      variations: 1,
      notes: "Revise the exact draft using the newest feedback rules. Return a replacement, not a commentary.",
      skillFile,
      examples: selectedExamples.onBrand,
      counterExamples: selectedExamples.counterExamples,
      providerConfig: providerConfigFromBody(body),
    });

    if (!result) return jsonError("Could not create a revised draft.", 502);

    const issuesJson = {
      issues: result.issues,
      suggestedRevisionDirection: result.suggestedRevisionDirection,
      revisedFromGenerationId: generation.id,
    };
    const revised = await prisma.generation.create({
      data: {
        brandId: generation.brandId,
        prompt: generation.prompt,
        tweetType: generation.tweetType,
        outputText: result.text,
        score: result.score,
        scoreLabel: result.scoreLabel,
        reason: result.reason,
        issuesJson: stringifyJsonField(issuesJson),
      },
    });

    return jsonOk({ generation: { ...revised, issuesJson } });
  } catch (error) {
    return jsonErrorFromUnknown(error, "Could not revise this draft.", 502);
  }
}
