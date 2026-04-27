import { afterEach, describe, expect, it, vi } from "vitest";
import type { VoiceSkillFile } from "@/lib/types";
import { generateTweets } from "@/lib/voice/generateTweets";

const skillFile = {
  brandName: "Acme",
  voiceSummary: "Specific and direct.",
  avoidedPhrases: ["game-changing"],
  preferredPhrases: [],
  linguisticRules: ["Use concrete language."],
  exampleLibrary: { onBrand: [], approvedGenerated: [], rejectedGenerated: [], offBrand: [] },
} as VoiceSkillFile;

describe("generateTweets reranking", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("generates a larger pool and returns the strongest requested count", async () => {
    const prompts: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
        const body = JSON.parse(String(init?.body));
        const prompt = String(body.messages?.[0]?.content || "");
        prompts.push(prompt);
        const text = prompt.includes("Evaluate these Twitter/X drafts")
          ? JSON.stringify({
              evaluations: [
                {
                  index: 0,
                  score: 42,
                  componentScores: { brandVoiceMatch: 10, twitterNativeness: 10, specificity: 6, hookQuality: 4, nonGeneric: 4, ctaFit: 3, safetyFactuality: 5 },
                  reason: "generic",
                  issues: ["Uses avoided phrase: game-changing"],
                  suggestedRevisionDirection: "Remove launch cliche.",
                  shouldShow: false,
                },
                {
                  index: 1,
                  score: 93,
                  componentScores: { brandVoiceMatch: 34, twitterNativeness: 19, specificity: 15, hookQuality: 10, nonGeneric: 10, ctaFit: 5, safetyFactuality: 5 },
                  reason: "specific and useful",
                  issues: [],
                  suggestedRevisionDirection: "Keep it direct.",
                  shouldShow: true,
                },
                {
                  index: 2,
                  score: 88,
                  componentScores: { brandVoiceMatch: 30, twitterNativeness: 18, specificity: 15, hookQuality: 9, nonGeneric: 8, ctaFit: 4, safetyFactuality: 4 },
                  reason: "clear",
                  issues: [],
                  suggestedRevisionDirection: "Tighten slightly.",
                  shouldShow: true,
                },
              ],
            })
          : JSON.stringify({
              tweets: [
                { text: "We are excited to announce a game-changing product.", reason: "bad", issues: [] },
                { text: "DeFi rewards work better when the next action is obvious: deposit, hold, earn.", reason: "good", issues: [] },
                { text: "Specific rewards beat vague campaigns when users know exactly what to do.", reason: "good", issues: [] },
              ],
            });
        return {
          ok: true,
          json: async () => ({
            content: [{ text }],
          }),
        };
      }),
    );

    const results = await generateTweets({
      context: "DeFi rewards launch",
      tweetType: "launch announcement",
      variations: 2,
      skillFile,
      examples: ["Specific rewards beat vague campaigns."],
      counterExamples: ["We are excited to announce a game-changing product."],
      providerConfig: { provider: "anthropic", apiKey: "key" },
      retrievalMode: "hybrid",
    });

    expect(results).toHaveLength(2);
    expect(prompts.some((prompt) => prompt.includes("Evaluate these Twitter/X drafts"))).toBe(true);
    expect(prompts.find((prompt) => prompt.includes("Evaluate these Twitter/X drafts"))).toContain("Specific rewards beat vague campaigns.");
    expect(results[0].score).toBeGreaterThanOrEqual(results[1].score);
    expect(results.every((result) => !result.text.includes("game-changing"))).toBe(true);
    expect(results[0].evaluationMetadata?.provenance?.retrievalMode).toBe("hybrid");
  });

  it("retries with stricter voice when the first candidate pool fails the threshold", async () => {
    let generateCalls = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
        const body = JSON.parse(String(init?.body));
        const prompt = String(body.messages?.[0]?.content || "");
        const isEvaluation = prompt.includes("Evaluate these Twitter/X drafts");
        const text = isEvaluation
          ? JSON.stringify({
              evaluations: [
                generateCalls === 1
                  ? {
                      index: 0,
                      score: 48,
                      componentScores: { brandVoiceMatch: 12, twitterNativeness: 9, specificity: 6, hookQuality: 4, nonGeneric: 4, ctaFit: 3, safetyFactuality: 5 },
                      reason: "too generic",
                      issues: ["Uses avoided phrase: game-changing"],
                      suggestedRevisionDirection: "Use a real mechanic.",
                      shouldShow: false,
                    }
                  : {
                      index: 0,
                      score: 91,
                      componentScores: { brandVoiceMatch: 33, twitterNativeness: 18, specificity: 15, hookQuality: 10, nonGeneric: 10, ctaFit: 5, safetyFactuality: 5 },
                      reason: "voice-faithful",
                      issues: [],
                      suggestedRevisionDirection: "Keep it.",
                      shouldShow: true,
                    },
              ],
            })
          : (() => {
              generateCalls += 1;
              expect(generateCalls === 1 || prompt.includes("STRICT VOICE RETRY")).toBe(true);
              return JSON.stringify({
                tweets: [
                  generateCalls === 1
                    ? { text: "We are excited to announce a game-changing product.", reason: "bad", issues: [] }
                    : { text: "DeFi rewards work better when the next action is obvious: deposit, hold, earn.", reason: "good", issues: [] },
                ],
              });
            })();

        return {
          ok: true,
          json: async () => ({
            content: [{ text }],
          }),
        };
      }),
    );

    const results = await generateTweets({
      context: "DeFi rewards launch",
      tweetType: "launch announcement",
      variations: 1,
      skillFile,
      examples: ["Specific rewards beat vague campaigns."],
      counterExamples: ["We are excited to announce a game-changing product."],
      providerConfig: { provider: "anthropic", apiKey: "key" },
    });

    expect(generateCalls).toBe(2);
    expect(results[0].score).toBeGreaterThanOrEqual(90);
    expect(results[0].evaluationMetadata?.retryCount).toBe(1);
  });

  it("does not return unsupported live claims even when the LLM evaluator scores them highly", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
        const body = JSON.parse(String(init?.body));
        const prompt = String(body.messages?.[0]?.content || "");
        const text = prompt.includes("Evaluate these Twitter/X drafts")
          ? JSON.stringify({
              evaluations: [
                {
                  index: 0,
                  score: 97,
                  componentScores: { brandVoiceMatch: 35, twitterNativeness: 20, specificity: 15, hookQuality: 10, nonGeneric: 10, ctaFit: 5, safetyFactuality: 5 },
                  reason: "punchy",
                  issues: [],
                  suggestedRevisionDirection: "Keep it.",
                  shouldShow: true,
                },
                {
                  index: 1,
                  score: 85,
                  componentScores: { brandVoiceMatch: 30, twitterNativeness: 17, specificity: 14, hookQuality: 9, nonGeneric: 8, ctaFit: 4, safetyFactuality: 3 },
                  reason: "safe and specific",
                  issues: [],
                  suggestedRevisionDirection: "Keep it.",
                  shouldShow: true,
                },
              ],
            })
          : JSON.stringify({
              tweets: [
                { text: "Live now: reward net supply, volume, or depth. Not raw deposits.", reason: "bad", issues: [] },
                { text: "KPI incentives should pay for usable liquidity, not raw deposits.", reason: "good", issues: [] },
              ],
            });

        return {
          ok: true,
          json: async () => ({
            content: [{ text }],
          }),
        };
      }),
    );

    const results = await generateTweets({
      context: "KPI incentives should target outcomes instead of raw deposits",
      tweetType: "single tweet",
      variations: 1,
      skillFile,
      examples: ["KPI incentives reward outcomes."],
      providerConfig: { provider: "anthropic", apiKey: "key" },
    });

    expect(results[0].text).not.toMatch(/live now/i);
    expect(results[0].text).toContain("usable liquidity");
  });
});
