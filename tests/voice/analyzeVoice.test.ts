import { afterEach, describe, expect, it, vi } from "vitest";
import {
  analyzeVoice,
  buildCorpusVoiceStats,
  chunkSamplesForAnalysis,
  getVoiceAnalysisStrategy,
  mergeVoiceReports,
  normalizeVoiceReport,
  selectAnalysisSamplesForPrompt,
} from "@/lib/voice/analyzeVoice";

describe("analyzeVoice", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("requires a real LLM provider for voice analysis instead of silently returning a placeholder report", async () => {
    await expect(
      analyzeVoice({
        brand: { name: "Acme", audience: "founders", beliefs: "specific beats generic" },
        samples: [
          { cleanedText: "Specific examples beat vague advice because readers can copy the move.", qualityScore: 90 },
          { cleanedText: "I trust sharp claims more when they include the tradeoff.", qualityScore: 85 },
        ],
        providerConfig: {},
      }),
    ).rejects.toThrow("A real LLM provider is required");
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

  it("keeps the analysis packet diverse instead of filling it with near duplicates", () => {
    const selected = selectAnalysisSamplesForPrompt(
      [
        { cleanedText: "KPI incentives reward outcomes, not raw deposits.", qualityScore: 99 },
        { cleanedText: "KPI incentives reward outcomes, not raw deposits.", qualityScore: 98 },
        { cleanedText: "KPI incentives reward outcomes, not raw deposits.", qualityScore: 97 },
        { cleanedText: "LPs understand campaigns when the action is concrete.", qualityScore: 75 },
      ],
      240,
    );

    expect(selected).toContain("KPI incentives reward outcomes, not raw deposits.");
    expect(selected).toContain("LPs understand campaigns when the action is concrete.");
    expect(selected.filter((sample) => sample.includes("raw deposits"))).toHaveLength(1);
  });

  it("uses chunked analysis only for lower-context models", () => {
    const lowContextStrategy = getVoiceAnalysisStrategy({ provider: "openai-compatible" });
    expect(lowContextStrategy.mode).toBe("chunked");
    expect(lowContextStrategy.maxChunks).toBe(1);
    expect(lowContextStrategy.sampleCharBudget).toBe(lowContextStrategy.chunkCharBudget);
    expect(getVoiceAnalysisStrategy({ provider: "openai-compatible", contextWindowTokens: 8192 }).maxChunks).toBe(2);
    expect(getVoiceAnalysisStrategy({ provider: "openai-compatible", contextWindowTokens: 32768 }).mode).toBe("direct");
    expect(getVoiceAnalysisStrategy({ provider: "anthropic" }).mode).toBe("direct");
  });

  it("does not hide low-context model failures behind heuristic reports", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("Local model returned malformed JSON.");
      }),
    );

    await expect(
      analyzeVoice({
        brand: { name: "Local Brand" },
        samples: [
          { cleanedText: "Concrete DeFi launch update\nwith preserved formatting and a clear CTA.", qualityScore: 90 },
          { cleanedText: "Another technical product note with specific language.", qualityScore: 80 },
        ],
        providerConfig: {
          provider: "openai-compatible",
          baseUrl: "http://localhost:1234/v1",
          apiKey: "test-key",
          model: "local-model",
        },
      }),
    ).rejects.toThrow("Local model returned malformed JSON.");
  });

  it("splits selected samples into budget-safe chunks", () => {
    const chunks = chunkSamplesForAnalysis(["a".repeat(10), "b".repeat(10), "c".repeat(10)], 25);

    expect(chunks).toEqual([["a".repeat(10), "b".repeat(10)], ["c".repeat(10)]]);
  });

  it("builds deterministic corpus mechanics from all samples", () => {
    const stats = buildCorpusVoiceStats(["Hello world\nsecond line 🚀", "Short one"]);

    expect(stats.averageTweetLength).toBe(17);
    expect(stats.usesEmojis).toBe(true);
    expect(stats.emojiFrequency).toBe("medium");
    expect(stats.lineBreakRate).toBe(50);
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
        ruleEvidence: [
          {
            rule: "Lead with the specific product mechanic.",
            confidence: "91",
            evidence: [
              {
                quote: "DeFi rewards work when the next action is obvious.",
                reason: "Specific mechanism appears before commentary.",
              },
            ],
          },
        ],
      },
      ["one", "two longer sample"],
    );

    expect(report.toneSliders.formalToCasual).toBe(40);
    expect(report.linguisticMechanics.averageTweetLength).toBe(10);
    expect(report.linguisticMechanics.sentenceLength).toBe("mixed");
    expect(report.linguisticMechanics.emojiFrequency).toBe("high");
    expect(report.ruleEvidence?.[0]).toEqual({
      rule: "Lead with the specific product mechanic.",
      confidence: 91,
      evidence: [
        {
          quote: "DeFi rewards work when the next action is obvious.",
          reason: "Specific mechanism appears before commentary.",
        },
      ],
    });
  });

  it("merges chunk reports while keeping corpus-derived mechanics authoritative", () => {
    const base = normalizeVoiceReport(
      {
        summary: "Chunk one summary.",
        personalityTraits: ["direct", "technical"],
        toneSliders: {
          formalToCasual: 20,
          seriousToFunny: 10,
          respectfulToIrreverent: 30,
          enthusiasticToMatterOfFact: 80,
          simpleToComplex: 60,
          warmToDetached: 40,
        },
        linguisticMechanics: {
          averageTweetLength: 120,
          sentenceLength: "short",
          usesEmojis: false,
          emojiFrequency: "none",
          punctuationStyle: "periods",
          capitalizationStyle: "standard",
          lineBreakStyle: "rare",
          firstPersonUsage: "low",
          secondPersonUsage: "low",
        },
        hookPatterns: ["News first"],
        endingPatterns: ["CTA"],
        preferredPhrases: ["LPs"],
        avoidedPhrases: ["generic"],
        contentPatterns: [{ name: "Update", description: "Status", structure: "Hook + list" }],
        exampleTweets: ["Example one"],
      },
      ["Example one"],
      buildCorpusVoiceStats(["one\nline 🚀", "two lines"]),
    );
    const merged = mergeVoiceReports([base], ["one\nline 🚀", "two lines"]);

    expect(merged.personalityTraits).toContain("direct");
    expect(merged.linguisticMechanics.usesEmojis).toBe(true);
    expect(merged.linguisticMechanics.lineBreakStyle).toContain("line breaks");
  });

  it("merges rule evidence from chunk reports", () => {
    const first = normalizeVoiceReport(
      {
        summary: "Chunk one.",
        ruleEvidence: [
          {
            rule: "Open with a concrete mechanic.",
            confidence: 88,
            evidence: [{ quote: "Deposits matter less than outcomes.", reason: "Mechanic first." }],
          },
        ],
      },
      ["Deposits matter less than outcomes."],
    );
    const second = normalizeVoiceReport(
      {
        summary: "Chunk two.",
        ruleEvidence: [
          {
            rule: "Avoid polished launch language.",
            confidence: 83,
            evidence: [{ quote: "No spreadsheet required.", reason: "Plain spoken closer." }],
          },
        ],
      },
      ["No spreadsheet required."],
    );

    const merged = mergeVoiceReports([first, second], ["Deposits matter less than outcomes.", "No spreadsheet required."]);

    expect(merged.ruleEvidence?.map((item) => item.rule)).toEqual([
      "Open with a concrete mechanic.",
      "Avoid polished launch language.",
    ]);
  });
});
