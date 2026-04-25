import { describe, expect, it } from "vitest";
import type { VoiceSkillFile } from "@/lib/types";
import { selectExamplesForGeneration } from "@/lib/voice/selectExamples";

const skillFile = {
  exampleLibrary: {
    onBrand: ["Specific DeFi incentives work when the user understands the action in one sentence."],
    approvedGenerated: ["Launch notes should name the exact user action before the reward."],
    rejectedGenerated: ["We are excited to announce a game-changing platform."],
    offBrand: [],
  },
  retrievalHints: {
    preferredTopics: ["defi", "incentives"],
    preferredStructures: ["claim then proof"],
    preferredVocabulary: ["specific", "user", "reward"],
    avoidVocabulary: ["game-changing"],
  },
} as VoiceSkillFile;

describe("selectExamplesForGeneration", () => {
  it("selects relevant on-brand and approved examples while separating counterexamples", () => {
    const result = selectExamplesForGeneration({
      context: "write a launch tweet about DeFi incentive rewards",
      tweetType: "launch announcement",
      skillFile,
      samples: [
        { cleanedText: "DeFi rewards work when the next action is obvious.", qualityScore: 95, classification: "useful" },
        { cleanedText: "Unrelated hiring update for the team.", qualityScore: 90, classification: "useful" },
      ],
      limit: 3,
    });

    expect(result.onBrand[0]).toContain("DeFi rewards");
    expect(result.onBrand.some((example) => example.includes("Launch notes"))).toBe(true);
    expect(result.counterExamples[0]).toContain("game-changing");
  });
});
