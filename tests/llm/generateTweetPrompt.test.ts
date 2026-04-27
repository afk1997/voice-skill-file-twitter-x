import { describe, expect, it } from "vitest";
import type { VoiceSkillFile } from "@/lib/types";
import { generateTweetPrompt } from "@/lib/llm/prompts/generateTweetPrompt";

describe("generateTweetPrompt", () => {
  it("puts hard learned constraints before examples and voice packet context", () => {
    const prompt = generateTweetPrompt({
      context: "Solana launch",
      tweetType: "launch announcement",
      variations: 1,
      skillFile: {
        version: "v1.4",
        brandName: "Metrom",
        voiceSummary: "Direct",
        linguisticRules: ["Do not use em dashes in generated tweets. Use commas, periods, colons, or shorter sentences instead."],
        avoidedPhrases: ["—"],
        preferredPhrases: ["permissionlessly"],
        exampleLibrary: { onBrand: [], offBrand: [], approvedGenerated: [], rejectedGenerated: [] },
        voiceKernel: {
          sampleCount: 50,
          length: { idealRange: [80, 130], median: 100, p90: 180, band: "medium" },
          formatting: {
            lineBreakRate: 12,
            commonLineBreakTemplates: ["<line>"],
            emojiFrequency: "none",
            commonEmojis: [],
            hashtagRate: 0,
            mentionRate: 0,
            urlRate: 0,
          },
          rhythm: {
            openingPatterns: ["Lead with the mechanic"],
            endingPatterns: ["End with the tradeoff"],
            punctuationHabit: "clean",
            capitalizationHabit: "standard",
            firstPersonRate: 8,
            secondPersonRate: 12,
          },
          vocabulary: {
            preferredTerms: ["permissionlessly"],
            preferredPhrases: [],
            forbiddenModelDefaults: ["—"],
          },
          generationRules: ["Stay near 80-130 characters."],
        },
      } as VoiceSkillFile,
      examples: ["Metrom campaigns pay for outcomes."],
    });

    const hardConstraintIndex = prompt.indexOf("Hard constraints");
    expect(hardConstraintIndex).toBeGreaterThan(-1);
    expect(prompt).toContain("Do not use em dashes");
    expect(prompt).toContain("Never use: —");
    expect(hardConstraintIndex).toBeLessThan(prompt.indexOf("Relevant examples"));
    expect(hardConstraintIndex).toBeLessThan(prompt.indexOf("Voice packet"));
    expect(prompt).toContain('"voiceKernel"');
    expect(prompt).not.toContain('"exampleLibrary"');
    expect(prompt).toContain("Do not start with a numbered thread marker like 1/ or 2/ unless tweet type is thread.");
    expect(prompt).toContain("Only use live, launch, available now, coming soon, or now supports when the context, notes, or tweet type explicitly says it.");
  });
});
