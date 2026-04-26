import { describe, expect, it } from "vitest";
import type { VoiceSkillFile } from "@/lib/types";
import { evaluateTweet } from "@/lib/voice/evaluateTweet";

const skillFile = {
  avoidedPhrases: ["game-changing"],
  preferredPhrases: ["specific beats generic"],
  linguisticRules: ["Use concrete language.", "Avoid polished corporate announcement language."],
  exampleLibrary: { onBrand: ["Specific examples beat vague advice."], approvedGenerated: [], rejectedGenerated: [], offBrand: [] },
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
});
