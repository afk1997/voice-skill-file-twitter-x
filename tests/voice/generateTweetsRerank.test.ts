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
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          content: [
            {
              text: JSON.stringify({
                tweets: [
                  { text: "We are excited to announce a game-changing product.", reason: "bad", issues: [] },
                  { text: "DeFi rewards work better when the next action is obvious: deposit, hold, earn.", reason: "good", issues: [] },
                  { text: "Specific rewards beat vague campaigns when users know exactly what to do.", reason: "good", issues: [] },
                ],
              }),
            },
          ],
        }),
      })),
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
    expect(results[0].score).toBeGreaterThanOrEqual(results[1].score);
    expect(results.every((result) => !result.text.includes("game-changing"))).toBe(true);
  });
});
