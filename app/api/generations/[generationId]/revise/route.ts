import { assertBrandAccess } from "@/lib/auth/brandAccess";
import { authErrorStatus } from "@/lib/auth/errors";
import { ensureCurrentUserProfile } from "@/lib/auth/currentUserProfile";
import { prisma } from "@/lib/db";
import { providerConfigFromBody, jsonError, jsonErrorFromUnknown, jsonOk, parseJsonField, stringifyJsonField } from "@/lib/request";
import type { VoiceSkillFile } from "@/lib/types";
import { NOTE_ONLY_FEEDBACK_LABEL } from "@/lib/voice/feedbackActions";
import { generateTweets } from "@/lib/voice/generateTweets";
import { selectHybridExamplesForGeneration } from "@/lib/voice/hybridRetrieval";
import { buildRevisionContext } from "@/lib/voice/reviseTweet";

export async function POST(request: Request, { params }: { params: Promise<{ generationId: string }> }) {
  try {
    const { generationId } = await params;
    const profile = await ensureCurrentUserProfile();
    const body = await request.json();

    const generation = await prisma.generation.findUnique({
      where: { id: generationId },
      include: { feedback: { orderBy: { createdAt: "desc" }, take: 5 } },
    });

    if (!generation) return jsonError("Generation not found.", 404);
    await assertBrandAccess({ profileId: profile.id, brandId: generation.brandId });

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
      select: {
        id: true,
        cleanedText: true,
        qualityScore: true,
        classification: true,
        embeddingJson: true,
        embeddingModel: true,
        embeddingHash: true,
      },
    });

    const feedbackNotes = generation.feedback.map((feedback) => (feedback.comment ? `${feedback.label}: ${feedback.comment}` : feedback.label));
    const revisionNotes = [
      body.comment && typeof body.comment === "string"
        ? `${typeof body.label === "string" && body.label && body.label !== NOTE_ONLY_FEEDBACK_LABEL ? body.label : "Revision note"}: ${body.comment}`
        : "",
    ].filter(Boolean);
    const context = buildRevisionContext({
      originalPrompt: generation.prompt,
      originalTweet: generation.outputText,
      feedbackNotes,
      revisionNotes,
    });

    const providerConfig = providerConfigFromBody(body);
    const selectedExamples = await selectHybridExamplesForGeneration({
      context,
      tweetType: generation.tweetType,
      notes: revisionNotes.join("\n"),
      skillFile,
      samples,
      limit: 10,
      providerConfig,
      saveEmbedding: async (sampleId, embedding) => {
        await prisma.contentSample.update({
          where: { id: sampleId },
          data: {
            embeddingJson: embedding.embeddingJson,
            embeddingModel: embedding.embeddingModel,
            embeddingHash: embedding.embeddingHash,
            embeddedAt: embedding.embeddedAt,
          },
        });
      },
    });

    const [result] = await generateTweets({
      context,
      tweetType: generation.tweetType,
      variations: 1,
      notes: [
        "Revise the exact draft using the newest feedback rules. Return a replacement, not a commentary.",
        ...revisionNotes,
      ].join("\n"),
      skillFile,
      examples: selectedExamples.onBrand,
      counterExamples: selectedExamples.counterExamples,
      providerConfig,
      retrievalMode: selectedExamples.retrievalMode,
    });

    if (!result) return jsonError("Could not create a revised draft.", 502);

    const issuesJson = {
      issues: result.issues,
      suggestedRevisionDirection: result.suggestedRevisionDirection,
      revisedFromGenerationId: generation.id,
      revisionNote: revisionNotes.join("\n") || undefined,
      componentScores: result.componentScores,
      styleDistance: result.evaluationMetadata?.styleDistance,
      provenance: result.evaluationMetadata?.provenance,
      retryCount: result.evaluationMetadata?.retryCount ?? 0,
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
    if (error instanceof Error && authErrorStatus(error) !== 500) return jsonError(error.message, authErrorStatus(error));
    return jsonErrorFromUnknown(error, "Could not revise this draft.", 502);
  }
}
