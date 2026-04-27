import { describe, expect, it } from "vitest";
import type { VoiceSkillFile } from "@/lib/types";
import { evaluateTweetsPrompt } from "@/lib/llm/prompts/evaluateTweetPrompt";

describe("evaluateTweetsPrompt", () => {
  it("compares drafts against the selected generation examples", () => {
    const prompt = evaluateTweetsPrompt({
      tweets: ["DeFi rewards work when the action is obvious."],
      context: "DeFi rewards launch",
      tweetType: "launch announcement",
      skillFile: {
        version: "v2.0",
        brandName: "Metrom",
        voiceSummary: "Direct and specific.",
        avoidedPhrases: [],
        preferredPhrases: [],
        linguisticRules: [],
        exampleLibrary: {
          onBrand: ["Old generic library example."],
          approvedGenerated: [],
          rejectedGenerated: [],
          offBrand: [],
        },
      } as VoiceSkillFile,
      examples: ["Selected retrieved example with the exact incentive structure."],
      counterExamples: ["Selected rejected counterexample."],
    });

    expect(prompt).toContain("Selected retrieved example with the exact incentive structure.");
    expect(prompt).toContain("Selected rejected counterexample.");
    expect(prompt).not.toContain("Old generic library example.");
  });
});
