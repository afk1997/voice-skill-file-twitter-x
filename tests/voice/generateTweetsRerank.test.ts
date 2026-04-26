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
    });

    expect(results).toHaveLength(2);
    expect(prompts.some((prompt) => prompt.includes("Evaluate these Twitter/X drafts"))).toBe(true);
    expect(results[0].score).toBeGreaterThanOrEqual(results[1].score);
    expect(results.every((result) => !result.text.includes("game-changing"))).toBe(true);
  });
});
