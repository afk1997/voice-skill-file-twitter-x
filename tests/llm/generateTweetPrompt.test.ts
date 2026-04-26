import { describe, expect, it } from "vitest";
import type { VoiceSkillFile } from "@/lib/types";
import { generateTweetPrompt } from "@/lib/llm/prompts/generateTweetPrompt";

describe("generateTweetPrompt", () => {
  it("puts hard learned constraints before examples and full skill file context", () => {
    const prompt = generateTweetPrompt({
      context: "Solana launch",
      tweetType: "launch announcement",
      variations: 1,
      skillFile: {
        brandName: "Metrom",
        voiceSummary: "Direct",
        linguisticRules: ["Do not use em dashes in generated tweets. Use commas, periods, colons, or shorter sentences instead."],
        avoidedPhrases: ["—"],
        preferredPhrases: ["permissionlessly"],
        exampleLibrary: { onBrand: [], offBrand: [], approvedGenerated: [], rejectedGenerated: [] },
      } as VoiceSkillFile,
      examples: ["Metrom campaigns pay for outcomes."],
    });

    const hardConstraintIndex = prompt.indexOf("Hard constraints");
    expect(hardConstraintIndex).toBeGreaterThan(-1);
    expect(prompt).toContain("Do not use em dashes");
    expect(prompt).toContain("Never use: —");
    expect(hardConstraintIndex).toBeLessThan(prompt.indexOf("Relevant examples"));
    expect(hardConstraintIndex).toBeLessThan(prompt.indexOf("Voice Skill File"));
  });
});
