import { describe, expect, it } from "vitest";
import type { VoiceSkillFile } from "@/lib/types";
import { scoreStyleDistance } from "@/lib/voice/styleDistance";

const skillFile = {
  voiceKernel: {
    sampleCount: 100,
    length: { idealRange: [70, 150], median: 110, p90: 190, band: "medium" },
    formatting: {
      lineBreakRate: 0,
      commonLineBreakTemplates: ["<line>"],
      emojiFrequency: "none",
      commonEmojis: [],
      hashtagRate: 0,
      mentionRate: 0,
      urlRate: 0,
    },
    rhythm: {
      openingPatterns: ["DeFi rewards"],
      endingPatterns: ["No waste"],
      punctuationHabit: "clean punctuation",
      capitalizationHabit: "standard capitalization",
      firstPersonRate: 0,
      secondPersonRate: 10,
    },
    vocabulary: {
      preferredTerms: ["defi", "rewards", "tradeoff"],
      preferredPhrases: ["no waste"],
      forbiddenModelDefaults: ["unlock", "seamless"],
    },
    stylometry: {
      topCharacterTrigrams: ["def", "efi", "fi ", " re", "rew", "war", "ard", "rds"],
      punctuationDensity: 7,
      averageWordCount: 12,
      questionRate: 0,
      exclamationRate: 0,
    },
    generationRules: ["Stay near 70-150 characters.", "Avoid emojis.", "Avoid hashtags."],
  },
  exampleLibrary: {
    onBrand: ["DeFi rewards work better when the next action is obvious. No waste."],
    approvedGenerated: [],
    rejectedGenerated: [],
    offBrand: [],
  },
} as VoiceSkillFile;

describe("scoreStyleDistance", () => {
  it("scores drafts against corpus shape and nearest examples", () => {
    const close = scoreStyleDistance({
      tweet: "DeFi rewards work better when the next action is obvious: deposit, hold, earn. No waste.",
      skillFile,
    });
    const far = scoreStyleDistance({
      tweet: "Unlock a seamless revolutionary ecosystem 🚀 #growth #future",
      skillFile,
    });

    expect(close.score).toBeGreaterThanOrEqual(80);
    expect(close.metrics.stylometryFit).toBeGreaterThan(70);
    expect(close.nearestExample?.text).toContain("DeFi rewards");
    expect(far.score).toBeLessThan(60);
    expect(far.metrics.stylometryFit).toBeLessThan(70);
    expect(far.issues).toContain("Uses model-default phrasing: unlock");
    expect(far.issues).toContain("Uses emoji despite a no-emoji corpus pattern");
    expect(far.issues).toContain("Uses hashtags despite a no-hashtag corpus pattern");
  });

  it("does not explain a non-availability draft with a live launch nearest example", () => {
    const result = scoreStyleDistance({
      tweet: "KPI rewards pay for depth, volume, or spread.",
      skillFile: {
        ...skillFile,
        exampleLibrary: {
          onBrand: [
            "KPI rewards are live now. Pay for depth, volume, or spread.",
            "Incentives should target market outcomes.",
          ],
          approvedGenerated: [],
          rejectedGenerated: [],
          offBrand: [],
        },
      },
    });

    expect(result.nearestExample?.text).toBe("Incentives should target market outcomes.");
  });

  it("does not explain a non-thread draft with a numbered thread fragment", () => {
    const result = scoreStyleDistance({
      tweet: "KPI rewards pay for depth, volume, or spread.",
      skillFile: {
        ...skillFile,
        exampleLibrary: {
          onBrand: [
            "1/ KPI rewards pay for depth, volume, or spread.",
            "Incentives should target market outcomes.",
          ],
          approvedGenerated: [],
          rejectedGenerated: [],
          offBrand: [],
        },
      },
    });

    expect(result.nearestExample?.text).toBe("Incentives should target market outcomes.");
  });

  it("omits nearest-example explanations when every candidate carries the wrong artifact", () => {
    const result = scoreStyleDistance({
      tweet: "KPI rewards pay for depth, volume, or spread.",
      skillFile: {
        ...skillFile,
        exampleLibrary: {
          onBrand: [
            "1/ KPI rewards pay for depth, volume, or spread.",
            "KPI rewards are live now. Pay for depth, volume, or spread.",
          ],
          approvedGenerated: [],
          rejectedGenerated: [],
          offBrand: [],
        },
      },
    });

    expect(result.nearestExample).toBeUndefined();
    expect(result.metrics.nearestExampleSimilarity).toBe(0);
  });
});
