import { describe, expect, it } from "vitest";
import { buildCorpusProfile } from "@/lib/voice/corpusProfile";

describe("buildCorpusProfile", () => {
  it("computes distribution and formatting metrics while preserving examples", () => {
    const profile = buildCorpusProfile([
      { cleanedText: "Launch day:\n\n1. Faster routing\n2. Better LP incentives", qualityScore: 95, classification: "useful" },
      { cleanedText: "Specific examples beat vague advice.", qualityScore: 90, classification: "useful" },
      { cleanedText: "We ship incentives that users can actually understand 🚀", qualityScore: 80, classification: "useful" },
    ]);

    expect(profile.sampleCount).toBe(3);
    expect(profile.length.average).toBeGreaterThan(20);
    expect(profile.length.p90).toBeGreaterThanOrEqual(profile.length.median);
    expect(profile.formatting.lineBreakRate).toBe(33);
    expect(profile.formatting.commonLineBreakTemplates[0]).toContain("<blank>");
    expect(profile.representativeExamples[0].text).toContain("\n\n");
    expect(profile.vocabulary.topTerms.length).toBeGreaterThan(0);
  });

  it("extracts hooks, endings, and recurring phrases", () => {
    const profile = buildCorpusProfile([
      { cleanedText: "DeFi incentives are broken when users need a spreadsheet to care.", qualityScore: 95, classification: "useful" },
      { cleanedText: "DeFi incentives work when they are simple enough to repeat.", qualityScore: 90, classification: "useful" },
      { cleanedText: "DeFi incentives should feel obvious before they feel clever.", qualityScore: 85, classification: "useful" },
    ]);

    expect(profile.hooks[0]).toContain("DeFi incentives");
    expect(profile.endings.length).toBeGreaterThan(0);
    expect(profile.vocabulary.topPhrases.some((phrase) => phrase.text.includes("defi incentives"))).toBe(true);
  });
});
