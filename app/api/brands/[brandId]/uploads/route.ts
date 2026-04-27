import { prisma } from "@/lib/db";
import { jsonError, jsonOk, stringifyJsonField } from "@/lib/request";
import { classifyTweets } from "@/lib/tweets/classifyTweet";
import { parseTweetFile } from "@/lib/tweets/parseTwitterArchive";

export async function POST(request: Request, { params }: { params: Promise<{ brandId: string }> }) {
  const { brandId } = await params;
  const brand = await prisma.brand.findUnique({ where: { id: brandId } });
  if (!brand) return jsonError("Brand not found.", 404);

  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return jsonError("Upload file is required.", 400);

  const upload = await prisma.upload.create({
    data: {
      brandId,
      fileName: file.name,
      fileType: file.type || file.name.split(".").pop() || "unknown",
      status: "processing",
    },
  });

  try {
    const parsed = await parseTweetFile(file.name, await file.arrayBuffer());
    const classified = classifyTweets(parsed.tweets);
    const counts = classified.reduce<Record<string, number>>((acc, tweet) => {
      acc[tweet.classification] = (acc[tweet.classification] ?? 0) + 1;
      return acc;
    }, {});
    const usefulItems = classified.filter((tweet) => tweet.usedForVoice).length;
    const excludedItems = classified.length - usefulItems;
    const summary = {
      totalFound: parsed.totalFound,
      imported: classified.length,
      usefulItems,
      excludedItems,
      counts,
      usefulPreview: classified.filter((tweet) => tweet.usedForVoice).slice(0, 20).map((tweet) => tweet.cleanedText),
    };

    await prisma.contentSample.createMany({
      data: classified.map((tweet) => ({
        brandId,
        uploadId: upload.id,
        rawText: tweet.rawText,
        cleanedText: tweet.cleanedText,
        sourceType: "twitter_archive",
        classification: tweet.classification,
        qualityScore: tweet.qualityScore,
        usedForVoice: tweet.usedForVoice,
        metadataJson: stringifyJsonField({
          createdAt: tweet.createdAt,
          favoriteCount: tweet.favoriteCount,
          retweetCount: tweet.retweetCount,
          hashtags: tweet.hashtags,
          mentions: tweet.mentions,
          urls: tweet.urls,
          language: tweet.language,
          isReply: tweet.metadata.isReply,
          replyContext: tweet.metadata.replyContext,
        }),
      })),
    });

    const updatedUpload = await prisma.upload.update({
      where: { id: upload.id },
      data: {
        status: "completed",
        totalItems: parsed.totalFound,
        usefulItems,
        excludedItems,
        summaryJson: stringifyJsonField(summary),
      },
    });

    return jsonOk({ upload: { ...updatedUpload, summaryJson: summary }, summary });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown parse error";
    await prisma.upload.update({
      where: { id: upload.id },
      data: { status: "failed", summaryJson: stringifyJsonField({ error: message }) },
    });
    return jsonError(message || "Could not parse upload.", 400);
  }
}
