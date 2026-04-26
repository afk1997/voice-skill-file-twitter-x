import type { GeneratedTweetResult, VoiceReport, VoiceSkillFile } from "@/lib/types";
import { evaluateTweet } from "@/lib/voice/evaluateTweet";

export function mockVoiceReport({ brandName, samples }: { brandName: string; samples: string[] }): VoiceReport {
  const averageTweetLength = Math.round(samples.reduce((sum, sample) => sum + sample.length, 0) / Math.max(samples.length, 1));
  const usesEmojis = samples.some((sample) => /[\u{1F300}-\u{1FAFF}]/u.test(sample));
  const questionCount = samples.filter((sample) => sample.includes("?")).length;

  return {
    summary: `${brandName} sounds direct, specific, and grounded in practical observations from its own writing samples.`,
    personalityTraits: ["direct", "practical", "specific", "clear"],
    toneSliders: {
      formalToCasual: 68,
      seriousToFunny: questionCount > 0 ? 45 : 32,
      respectfulToIrreverent: 28,
      enthusiasticToMatterOfFact: 64,
      simpleToComplex: 38,
      warmToDetached: 57,
    },
    linguisticMechanics: {
      averageTweetLength,
      sentenceLength: averageTweetLength < 90 ? "short" : averageTweetLength > 170 ? "long" : "medium",
      usesEmojis,
      emojiFrequency: usesEmojis ? "low" : "none",
      punctuationStyle: questionCount > 0 ? "periods with occasional questions" : "clean periods and short clauses",
      capitalizationStyle: "sentence case",
      lineBreakStyle: samples.some((sample) => sample.includes("\n")) ? "uses line breaks for emphasis" : "mostly single paragraph",
      firstPersonUsage: samples.some((sample) => /\bI\b|\bwe\b/i.test(sample)) ? "medium" : "low",
      secondPersonUsage: samples.some((sample) => /\byou\b/i.test(sample)) ? "medium" : "low",
    },
    hookPatterns: ["Start with a concrete claim", "Name the tradeoff before the advice"],
    endingPatterns: ["End with a practical takeaway", "Close without forced CTA language"],
    preferredPhrases: ["specific beats generic", "concrete examples"],
    avoidedPhrases: ["game-changing", "revolutionary", "we are excited to announce"],
    contentPatterns: [
      {
        name: "Claim with reason",
        description: "Makes a clear claim and immediately explains the practical reason.",
        structure: "claim -> because/reason -> takeaway",
      },
    ],
    exampleTweets: samples.slice(0, 5),
  };
}

export function mockGeneratedTweets({
  context,
  tweetType,
  variations,
  skillFile,
}: {
  context: string;
  tweetType: string;
  variations: number;
  skillFile: VoiceSkillFile;
}): GeneratedTweetResult[] {
  const draftToRevise = context.match(/Draft to revise:\s*([\s\S]*?)(?:\n\nFeedback already applied|\n\nReturn one improved|$)/i)?.[1]?.trim();
  const hasEmDashBan =
    skillFile.avoidedPhrases?.includes("—") ||
    skillFile.linguisticRules?.some((rule) => /do not use em dashes|avoid em dashes/i.test(rule));

  return Array.from({ length: variations }).map((_, index) => {
    const text = draftToRevise
      ? reviseMockDraft({ draft: draftToRevise, index, hasEmDashBan })
      : index === 0
        ? `${context} gets easier when the voice file is specific enough to reject generic drafts.`
        : `${skillFile.brandName} voice rule ${index + 1}: keep the tweet concrete, useful, and close to the source writing.`;
    const evaluation = evaluateTweet({ tweet: text, context, tweetType, skillFile });
    return {
      text,
      score: evaluation.score,
      scoreLabel: evaluation.scoreLabel,
      reason: evaluation.reason,
      issues: evaluation.issues,
      suggestedRevisionDirection: evaluation.suggestedRevisionDirection,
    };
  });
}

function reviseMockDraft({ draft, index, hasEmDashBan }: { draft: string; index: number; hasEmDashBan: boolean }) {
  const revised = hasEmDashBan ? draft.replace(/\s*—\s*/g, ", ") : draft;
  if (index === 0) return revised.replace(/\s+/g, " ").trim();
  return `${revised.replace(/\s+/g, " ").trim()} Specific beats generic.`;
}
