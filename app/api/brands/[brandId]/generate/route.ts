import { prisma } from "@/lib/db";
import { providerConfigFromBody, jsonError, jsonErrorFromUnknown, jsonOk, parseJsonField, stringifyJsonField } from "@/lib/request";
import type { VoiceSkillFile } from "@/lib/types";
import { generateTweets } from "@/lib/voice/generateTweets";
import { selectHybridExamplesForGeneration } from "@/lib/voice/hybridRetrieval";

export async function POST(request: Request, { params }: { params: Promise<{ brandId: string }> }) {
  const { brandId } = await params;
  const body = await request.json();

  if (!body.context || typeof body.context !== "string") {
    return jsonError("Generation context is required.", 400);
  }

  const latestSkillFile = await prisma.skillFile.findFirst({
    where: { brandId },
    orderBy: { createdAt: "desc" },
  });

  if (!latestSkillFile) {
    return jsonError("Analyze voice and create a skill file before generating tweets.", 400);
  }

  const skillFile = parseJsonField<VoiceSkillFile | null>(latestSkillFile.skillJson, null);
  if (!skillFile) return jsonError("Latest skill file could not be parsed.", 500);

  const samples = await prisma.contentSample.findMany({
    where: { brandId, usedForVoice: true },
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

  try {
    const providerConfig = providerConfigFromBody(body);
    const selectedExamples = await selectHybridExamplesForGeneration({
      context: body.context,
      tweetType: body.tweetType || "single tweet",
      notes: body.notes || "",
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

    const results = await generateTweets({
      context: body.context,
      tweetType: body.tweetType || "single tweet",
      variations: Number(body.variations || 3),
      notes: body.notes || "",
      skillFile,
      examples: selectedExamples.onBrand,
      counterExamples: selectedExamples.counterExamples,
      providerConfig,
      retrievalMode: selectedExamples.retrievalMode,
    });

    const generations = await Promise.all(
      results.map(async (result) => {
        const issuesJson = {
          issues: result.issues,
          suggestedRevisionDirection: result.suggestedRevisionDirection,
          componentScores: result.componentScores,
          styleDistance: result.evaluationMetadata?.styleDistance,
          provenance: result.evaluationMetadata?.provenance,
          retryCount: result.evaluationMetadata?.retryCount ?? 0,
        };
        const generation = await prisma.generation.create({
          data: {
            brandId,
            prompt: body.context,
            tweetType: body.tweetType || "single tweet",
            outputText: result.text,
            score: result.score,
            scoreLabel: result.scoreLabel,
            reason: result.reason,
            issuesJson: stringifyJsonField(issuesJson),
          },
        });
        return { ...generation, issuesJson };
      }),
    );

    return jsonOk({ generations });
  } catch (error) {
    return jsonErrorFromUnknown(error, "Could not generate tweets.", 502);
  }
}
