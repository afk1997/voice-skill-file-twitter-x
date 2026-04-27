import { describe, expect, it } from "vitest";
import type { VoiceReport } from "@/lib/types";
import { buildSkillFileFromVoiceAnalysis } from "@/lib/voice/analysisSkillFile";

const report: VoiceReport = {
  summary: "Direct, specific, incentive-native voice.",
  personalityTraits: ["direct", "technical"],
  toneSliders: {
    formalToCasual: 60,
    seriousToFunny: 30,
    respectfulToIrreverent: 35,
    enthusiasticToMatterOfFact: 68,
    simpleToComplex: 54,
    warmToDetached: 42,
  },
  linguisticMechanics: {
    averageTweetLength: 118,
    sentenceLength: "mixed",
    usesEmojis: false,
    emojiFrequency: "none",
    punctuationStyle: "clean",
    capitalizationStyle: "standard",
    lineBreakStyle: "occasional line breaks",
    firstPersonUsage: "low",
    secondPersonUsage: "medium",
  },
  hookPatterns: ["Lead with the incentive problem"],
  endingPatterns: ["End with a concrete action"],
  preferredPhrases: ["programmable incentives"],
  avoidedPhrases: ["game-changing"],
  contentPatterns: [{ name: "Problem then mechanic", description: "Names the issue before the incentive design", structure: "Problem -> mechanism -> action" }],
  exampleTweets: ["Mercenary liquidity is what happens when incentives optimize for deposits instead of outcomes."],
};

const samples = [
  { cleanedText: "KPI-based incentives work when protocols reward outcomes, not just deposits.", qualityScore: 95 },
  { cleanedText: "Liquidity mining gets more useful when the campaign has a programmable goal.", qualityScore: 92 },
  { cleanedText: "The best LP incentives feel obvious before they feel clever.", qualityScore: 88 },
];

describe("buildSkillFileFromVoiceAnalysis", () => {
  it("creates a corpus-backed first Skill File from all useful analysis samples", () => {
    const result = buildSkillFileFromVoiceAnalysis({
      version: "v1.0",
      brand: { name: "Metrom", audience: "protocol teams", beliefs: "incentives should be measurable" },
      report,
      samples,
      generatedWith: "claude-sonnet-4-6",
    });

    expect(result.version).toBe("v1.0");
    expect(result.skillFile.modelNotes?.corpusSampleCount).toBe(3);
    expect(result.skillFile.corpusProfile?.sampleCount).toBe(3);
    expect(result.skillFile.retrievalHints?.preferredVocabulary).toContain("incentives");
    expect(result.skillFile.retrievalHints?.preferredTopics).toContain("incentives");
  });

  it("increments the Skill File version when re-analysis refreshes the voice artifact", () => {
    const result = buildSkillFileFromVoiceAnalysis({
      previousVersion: "v1.6",
      brand: { name: "Metrom" },
      report,
      samples,
    });

    expect(result.version).toBe("v1.7");
    expect(result.skillFile.version).toBe("v1.7");
    expect(result.skillFile.corpusProfile?.sampleCount).toBe(3);
  });

  it("preserves feedback learning when re-analysis refreshes corpus evidence", () => {
    const previous = buildSkillFileFromVoiceAnalysis({
      version: "v1.6",
      brand: { name: "Metrom" },
      report,
      samples,
    }).skillFile;
    const previousSkillFile = {
      ...previous,
      exampleLibrary: {
        ...previous.exampleLibrary,
        approvedGenerated: ["Approved generated line."],
        rejectedGenerated: ["Rejected generated line."],
      },
      rules: [
        ...(previous.rules ?? []),
        {
          id: "feedback-too-polished",
          layer: "feedback" as const,
          rule: "Avoid polished corporate announcement language.",
          confidence: 84,
          supportingExamples: [],
          counterExamples: ["Rejected generated line."],
          appliesTo: ["all"],
        },
      ],
    };
    const input = {
      previousVersion: "v1.6",
      previousSkillFile,
      brand: { name: "Metrom" },
      report,
      samples,
    };

    const result = buildSkillFileFromVoiceAnalysis(input);

    expect(result.skillFile.exampleLibrary.approvedGenerated).toContain("Approved generated line.");
    expect(result.skillFile.exampleLibrary.rejectedGenerated).toContain("Rejected generated line.");
    expect(result.skillFile.rules?.some((rule) => rule.id === "feedback-too-polished")).toBe(true);
  });

  it("keeps reply samples out of opening hooks when classification is available", () => {
    const result = buildSkillFileFromVoiceAnalysis({
      version: "v1.8",
      brand: { name: "Metrom" },
      report,
      samples: [
        { cleanedText: "KPI-based incentives reward market outcomes.", qualityScore: 95, classification: "useful" },
        { cleanedText: "Excited for this team", qualityScore: 99, classification: "reply" },
      ],
    });

    const hooks = (result.skillFile.corpusProfile?.hooks as string[]) ?? [];
    expect(hooks).toContain("KPI-based incentives reward market outcomes");
    expect(hooks).not.toContain("Excited for this team");
  });
});
