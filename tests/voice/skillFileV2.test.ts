import { describe, expect, it } from "vitest";
import type { VoiceReport } from "@/lib/types";
import { buildCorpusProfile } from "@/lib/voice/corpusProfile";
import { createVoiceSkillFile } from "@/lib/voice/createSkillFile";

const report: VoiceReport = {
  summary: "Direct, specific, and product-native.",
  personalityTraits: ["direct", "technical"],
  toneSliders: {
    formalToCasual: 62,
    seriousToFunny: 25,
    respectfulToIrreverent: 35,
    enthusiasticToMatterOfFact: 70,
    simpleToComplex: 58,
    warmToDetached: 45,
  },
  linguisticMechanics: {
    averageTweetLength: 120,
    sentenceLength: "mixed",
    usesEmojis: false,
    emojiFrequency: "none",
    punctuationStyle: "clean",
    capitalizationStyle: "standard",
    lineBreakStyle: "occasional line breaks",
    firstPersonUsage: "medium",
    secondPersonUsage: "low",
  },
  hookPatterns: ["Lead with a concrete claim"],
  endingPatterns: ["End with a practical takeaway"],
  preferredPhrases: ["specific beats generic"],
  avoidedPhrases: ["game-changing"],
  contentPatterns: [{ name: "Claim then proof", description: "Claim with concrete detail", structure: "Claim -> reason -> takeaway" }],
  exampleTweets: ["Specific examples beat vague advice because readers can copy the move."],
};

describe("createVoiceSkillFile v2", () => {
  it("adds schema version, corpus metadata, evidence-backed rules, and retrieval hints", () => {
    const corpusProfile = buildCorpusProfile([
      { cleanedText: "Specific examples beat vague advice because readers can copy the move.", qualityScore: 95 },
      { cleanedText: "Launch notes work better when they name the actual tradeoff.", qualityScore: 90 },
    ]);

    const skillFile = createVoiceSkillFile({
      version: "v1.0",
      brand: { name: "Acme", audience: "founders", beliefs: "specific beats generic" },
      report,
      corpusProfile,
      generatedWith: "claude-sonnet-4-6",
    });

    expect(skillFile.schemaVersion).toBe("2.0");
    expect(skillFile.modelNotes?.preferredQualityModel).toBe("claude-sonnet-4-6");
    expect(skillFile.modelNotes?.corpusSampleCount).toBe(2);
    expect(skillFile.rules?.some((rule) => rule.supportingExamples.length > 0)).toBe(true);
    expect(skillFile.retrievalHints?.preferredVocabulary).toContain("specific");
  });
});
