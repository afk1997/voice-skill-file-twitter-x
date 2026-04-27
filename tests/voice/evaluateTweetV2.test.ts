import { describe, expect, it } from "vitest";
import type { VoiceSkillFile } from "@/lib/types";
import { evaluateTweet } from "@/lib/voice/evaluateTweet";

const skillFile = {
  avoidedPhrases: ["game-changing"],
  preferredPhrases: ["specific beats generic"],
  linguisticRules: ["Use concrete language.", "Avoid polished corporate announcement language."],
  exampleLibrary: { onBrand: ["Specific examples beat vague advice."], approvedGenerated: [], rejectedGenerated: [], offBrand: [] },
  voiceKernel: {
    sampleCount: 100,
    length: { idealRange: [75, 150], median: 110, p90: 190, band: "medium" },
    formatting: {
      lineBreakRate: 5,
      commonLineBreakTemplates: ["<line>"],
      emojiFrequency: "none",
      commonEmojis: [],
      hashtagRate: 0,
      mentionRate: 0,
      urlRate: 0,
    },
    rhythm: {
      openingPatterns: ["Lead with concrete nouns"],
      endingPatterns: ["End on a practical consequence"],
      punctuationHabit: "clean punctuation",
      capitalizationHabit: "standard capitalization",
      firstPersonRate: 10,
      secondPersonRate: 8,
    },
    vocabulary: {
      preferredTerms: ["specific", "tradeoff", "reward"],
      preferredPhrases: ["specific beats generic"],
      forbiddenModelDefaults: ["unlock", "seamless"],
    },
    generationRules: ["Stay near 75-150 characters.", "Avoid emojis."],
  },
} as VoiceSkillFile;

describe("evaluateTweet v2", () => {
  it("returns component scores and penalizes generic corporate language", () => {
    const result = evaluateTweet({
      tweet: "We are excited to announce a game-changing solution for everyone.",
      context: "launch a DeFi rewards product",
      tweetType: "launch announcement",
      skillFile,
    });

    expect(result.componentScores.brandVoiceMatch).toBeLessThan(25);
    expect(result.issues).toContain("Uses avoided phrase: game-changing");
    expect(result.shouldShow).toBe(false);
  });

  it("rewards concrete Twitter-native drafts", () => {
    const result = evaluateTweet({
      tweet: "DeFi rewards work better when the next action is obvious: deposit, hold, earn. No spreadsheet required.",
      context: "DeFi rewards launch",
      tweetType: "single tweet",
      skillFile,
    });

    expect(result.score).toBeGreaterThanOrEqual(80);
    expect(result.componentScores.specificity).toBeGreaterThan(10);
    expect(result.shouldShow).toBe(true);
  });

  it("enforces learned punctuation constraints from the skill file", () => {
    const result = evaluateTweet({
      tweet: "Solana rewards are live — set targets and only pay for liquidity that hits them.",
      context: "Solana rewards launch",
      tweetType: "single tweet",
      skillFile: {
        ...skillFile,
        avoidedPhrases: ["—"],
        linguisticRules: [
          ...skillFile.linguisticRules,
          "Do not use em dashes in generated tweets. Use commas, periods, colons, or shorter sentences instead.",
        ],
      },
    });

    expect(result.issues).toContain("Violates learned punctuation rule: do not use em dashes");
    expect(result.shouldShow).toBe(false);
  });

  it("penalizes drafts that miss the voice kernel shape", () => {
    const result = evaluateTweet({
      tweet:
        "Unlock a seamless, revolutionary ecosystem experience for everyone 🚀🚀🚀 #growth #innovation #future",
      context: "DeFi rewards launch",
      tweetType: "single tweet",
      skillFile,
    });

    expect(result.issues).toContain("Uses model-default phrasing: unlock");
    expect(result.issues).toContain("Uses emoji despite a no-emoji voice kernel");
    expect(result.issues).toContain("Uses hashtags despite a no-hashtag voice kernel");
    expect(result.score).toBeLessThan(70);
    expect(result.shouldShow).toBe(false);
  });

  it("rejects numbered thread fragments for non-thread tweets", () => {
    const result = evaluateTweet({
      tweet: "2/ Raw deposits inflate TVL. KPI-based campaigns pay for usable liquidity.",
      context: "KPI incentives",
      tweetType: "single tweet",
      skillFile,
    });

    expect(result.issues).toContain("Starts with a thread marker for a non-thread draft");
    expect(result.shouldShow).toBe(false);
  });

  it("rejects live or availability claims when the request does not support them", () => {
    const result = evaluateTweet({
      tweet: "Live now: reward net supply, volume, or depth. Not raw deposits.",
      context: "KPI incentives should target outcomes instead of raw deposits",
      tweetType: "single tweet",
      skillFile,
    });

    expect(result.issues).toContain("Uses live or availability wording not supported by the request context");
    expect(result.shouldShow).toBe(false);
  });

  it("allows live or availability claims when notes support them", () => {
    const result = evaluateTweet({
      tweet: "Live now: reward net supply, volume, or depth. Not raw deposits.",
      context: "KPI incentives should target outcomes instead of raw deposits",
      tweetType: "single tweet",
      notes: "The campaign is live today.",
      skillFile,
    });

    expect(result.issues).not.toContain("Uses live or availability wording not supported by the request context");
  });
});
