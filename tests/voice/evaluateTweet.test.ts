import { describe, expect, it } from "vitest";
import { evaluateTweet, scoreLabel } from "@/lib/voice/evaluateTweet";
import type { VoiceSkillFile } from "@/lib/types";

const skill = {
  brandName: "Acme",
  voiceSummary: "Direct and practical",
  preferredPhrases: ["specific beats generic"],
  avoidedPhrases: ["game-changing"],
  qualityRubric: {
    brandVoiceMatch: 35,
    twitterNativeness: 20,
    specificity: 15,
    hookQuality: 10,
    nonGeneric: 10,
    ctaFit: 5,
  },
} as VoiceSkillFile;

describe("evaluateTweet", () => {
  it("labels scores using the required ranges", () => {
    expect(scoreLabel(95)).toBe("Very strong match");
    expect(scoreLabel(85)).toBe("Strong match");
    expect(scoreLabel(75)).toBe("Good match");
    expect(scoreLabel(65)).toBe("Weak match");
  });

  it("penalizes banned generic phrasing", () => {
    const result = evaluateTweet({
      tweet: "We are excited to announce a game-changing solution.",
      context: "launch",
      tweetType: "launch announcement",
      skillFile: skill,
    });

    expect(result.score).toBeLessThan(70);
    expect(result.issues).toContain("Uses avoided phrase: game-changing");
  });
});
