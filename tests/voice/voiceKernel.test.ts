import { describe, expect, it } from "vitest";
import { buildCorpusProfile } from "@/lib/voice/corpusProfile";
import { buildVoiceKernel } from "@/lib/voice/voiceKernel";

describe("buildVoiceKernel", () => {
  it("turns corpus mechanics into a compact generation kernel", () => {
    const corpusProfile = buildCorpusProfile([
      {
        cleanedText: "DeFi rewards work when the next action is obvious:\ndeposit, hold, earn.",
        qualityScore: 95,
      },
      {
        cleanedText: "Mercenary liquidity is what happens when rewards optimize for deposits instead of outcomes.",
        qualityScore: 90,
      },
      {
        cleanedText: "The best launch notes name the user action before the incentive.",
        qualityScore: 88,
      },
    ]);

    const kernel = buildVoiceKernel({
      corpusProfile,
      avoidedPhrases: ["game-changing"],
    });

    expect(kernel.sampleCount).toBe(3);
    expect(kernel.length.idealRange).toEqual([64, 91]);
    expect(kernel.formatting.lineBreakRate).toBe(33);
    expect(kernel.formatting.commonLineBreakTemplates[0]).toContain("<line>");
    expect(kernel.rhythm.openingPatterns[0]).toContain("DeFi rewards");
    expect(kernel.vocabulary.preferredTerms).toContain("rewards");
    expect(kernel.vocabulary.forbiddenModelDefaults).toContain("game-changing");
    expect(kernel.stylometry.topCharacterTrigrams.length).toBeGreaterThan(0);
    expect(kernel.stylometry.averageWordCount).toBeGreaterThan(0);
    expect(kernel.generationRules.some((rule) => rule.includes("Stay near 64-91 characters"))).toBe(true);
  });
});
