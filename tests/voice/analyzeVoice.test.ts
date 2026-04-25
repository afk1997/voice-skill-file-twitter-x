import { describe, expect, it } from "vitest";
import { analyzeVoice, normalizeVoiceReport, selectAnalysisSamplesForPrompt } from "@/lib/voice/analyzeVoice";

describe("analyzeVoice", () => {
  it("creates a heuristic report without provider credentials", async () => {
    const report = await analyzeVoice({
      brand: { name: "Acme", audience: "founders", beliefs: "specific beats generic" },
      samples: [
        { cleanedText: "Specific examples beat vague advice because readers can copy the move.", qualityScore: 90 },
        { cleanedText: "I trust sharp claims more when they include the tradeoff.", qualityScore: 85 },
      ],
      providerConfig: {},
    });

    expect(report.summary).toContain("Acme");
    expect(report.exampleTweets).toHaveLength(2);
    expect(report.linguisticMechanics.averageTweetLength).toBeGreaterThan(20);
  });

  it("caps prompt samples by character budget while preserving quality order", () => {
    const selected = selectAnalysisSamplesForPrompt(
      [
        { cleanedText: "lowest quality should not win", qualityScore: 20 },
        { cleanedText: "highest quality line with enough detail", qualityScore: 95 },
        { cleanedText: "second best sample with detail", qualityScore: 90 },
      ],
      75,
    );

    expect(selected).toEqual(["highest quality line with enough detail", "second best sample with detail"]);
  });

  it("normalizes loose local model voice reports into the app schema", () => {
    const report = normalizeVoiceReport(
      {
        summary: "Technical and direct.",
        personalityTraits: ["Direct"],
        toneSliders: {
          formalToCasual: 2,
          seriousToFunny: 1,
          respectfulToIrreverent: 3,
          enthusiasticToMatterOfFact: 2,
          simpleToComplex: 3,
          warmToDetached: 4,
        },
        linguisticMechanics: {
          averageTweetLength: 3,
          sentenceLength: "mixed (short and long)",
          usesEmojis: true,
          emojiFrequency: "high (many emojis)",
          punctuationStyle: "bullets",
          capitalizationStyle: "caps for emphasis",
          lineBreakStyle: "frequent",
          firstPersonUsage: "low",
          secondPersonUsage: "medium",
        },
        hookPatterns: ["News first"],
        endingPatterns: ["CTA"],
        preferredPhrases: ["LPs"],
        avoidedPhrases: ["generic"],
        contentPatterns: [{ name: "Update", description: "Status", structure: "Hook + list" }],
        exampleTweets: ["Hello\nworld"],
      },
      ["one", "two longer sample"],
    );

    expect(report.toneSliders.formalToCasual).toBe(40);
    expect(report.linguisticMechanics.averageTweetLength).toBe(10);
    expect(report.linguisticMechanics.sentenceLength).toBe("mixed");
    expect(report.linguisticMechanics.emojiFrequency).toBe("high");
  });
});
