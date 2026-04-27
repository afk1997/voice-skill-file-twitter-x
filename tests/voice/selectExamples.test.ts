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

  it("prefers examples that match the voice kernel structure, not only lexical topic", () => {
    const result = selectExamplesForGeneration({
      context: "write about DeFi rewards",
      tweetType: "single tweet",
      skillFile: {
        ...skillFile,
        voiceKernel: {
          sampleCount: 200,
          length: { idealRange: [60, 150], median: 100, p90: 190, band: "medium" },
          formatting: {
            lineBreakRate: 80,
            commonLineBreakTemplates: ["<line>\n<line>"],
            emojiFrequency: "none",
            commonEmojis: [],
            hashtagRate: 0,
            mentionRate: 0,
            urlRate: 0,
          },
          rhythm: {
            openingPatterns: ["DeFi rewards"],
            endingPatterns: ["No waste"],
            punctuationHabit: "clean",
            capitalizationHabit: "standard",
            firstPersonRate: 0,
            secondPersonRate: 10,
          },
          vocabulary: {
            preferredTerms: ["defi", "rewards"],
            preferredPhrases: [],
            forbiddenModelDefaults: [],
          },
          generationRules: ["Use multi-line formatting often."],
        },
      } as VoiceSkillFile,
      samples: [
        { cleanedText: "DeFi rewards work better when every user action is obvious and measurable.", qualityScore: 98 },
        { cleanedText: "DeFi rewards work better\nwhen every user action is obvious.", qualityScore: 75 },
      ],
      limit: 2,
    });

    expect(result.onBrand[0]).toContain("\n");
  });

  it("uses semantic similarity before reranking with the voice kernel", () => {
    const result = selectExamplesForGeneration({
      context: "write about liquidity mining rewards",
      contextEmbedding: [1, 0],
      tweetType: "single tweet",
      skillFile: {
        ...skillFile,
        voiceKernel: {
          sampleCount: 200,
          length: { idealRange: [20, 160], median: 90, p90: 180, band: "medium" },
          formatting: {
            lineBreakRate: 75,
            commonLineBreakTemplates: ["<line>\n<line>"],
            emojiFrequency: "none",
            commonEmojis: [],
            hashtagRate: 0,
            mentionRate: 0,
            urlRate: 0,
          },
          rhythm: {
            openingPatterns: ["Builders earn"],
            endingPatterns: [],
            punctuationHabit: "clean",
            capitalizationHabit: "standard",
            firstPersonRate: 0,
            secondPersonRate: 0,
          },
          vocabulary: {
            preferredTerms: ["builders", "earn"],
            preferredPhrases: [],
            forbiddenModelDefaults: [],
          },
          generationRules: ["Use multi-line formatting often."],
        },
      } as VoiceSkillFile,
      samples: [
        {
          cleanedText: "Liquidity mining rewards unlock scalable growth for every DeFi user.",
          qualityScore: 98,
          embedding: [0.15, 0.85],
        },
        {
          cleanedText: "Builders earn when the action is clear.\nNo ceremony.",
          qualityScore: 72,
          embedding: [0.98, 0.02],
        },
      ],
      limit: 2,
    });

    expect(result.retrievalMode).toBe("hybrid");
    expect(result.onBrand[0]).toContain("Builders earn");
  });

  it("downranks numbered thread fragments for single-tweet requests", () => {
    const result = selectExamplesForGeneration({
      context: "write about KPI incentives",
      tweetType: "single tweet",
      skillFile,
      samples: [
        { cleanedText: "8/ KPI-based incentives reduce token wastage and create clearer goals.", qualityScore: 99, classification: "thread_candidate" },
        { cleanedText: "KPI-based incentives reward the outcome you actually want.", qualityScore: 80, classification: "useful" },
      ],
      limit: 2,
    });

    expect(result.onBrand[0]).not.toMatch(/^\d+\//);
  });

  it("downranks launch and live examples when the request is not about availability", () => {
    const result = selectExamplesForGeneration({
      context: "write about KPI-based incentives for deposits",
      tweetType: "single tweet",
      skillFile,
      samples: [
        { cleanedText: "KPI-based incentives are live now for raw deposits.", qualityScore: 100, classification: "useful" },
        { cleanedText: "KPI-based incentives reward outcomes.", qualityScore: 70, classification: "useful" },
      ],
      limit: 2,
    });

    expect(result.onBrand[0]).not.toMatch(/live now|are live/i);
  });

  it("removes unsupported launch and live examples from the selected evidence set", () => {
    const result = selectExamplesForGeneration({
      context: "write about KPI-based incentives for deposits",
      tweetType: "single tweet",
      skillFile,
      samples: [
        { cleanedText: "KPI-based incentives are live now for raw deposits.", qualityScore: 100, classification: "useful" },
        { cleanedText: "KPI-based incentives reward outcomes.", qualityScore: 70, classification: "useful" },
      ],
      limit: 2,
    });

    expect(result.onBrand.join("\n")).not.toMatch(/live now|are live/i);
    expect(result.onBrand).toContain("KPI-based incentives reward outcomes.");
  });

  it("keeps launch and live examples when notes support availability", () => {
    const result = selectExamplesForGeneration({
      context: "write about KPI-based incentives for deposits",
      tweetType: "single tweet",
      notes: "The campaign is live today.",
      skillFile,
      samples: [
        { cleanedText: "KPI-based incentives are live now for raw deposits.", qualityScore: 100, classification: "useful" },
        { cleanedText: "KPI-based incentives reward outcomes.", qualityScore: 70, classification: "useful" },
      ],
      limit: 2,
    });

    expect(result.onBrand.join("\n")).toMatch(/live now|are live/i);
  });
});
