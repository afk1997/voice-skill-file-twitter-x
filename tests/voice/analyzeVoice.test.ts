import { describe, expect, it } from "vitest";
import { analyzeVoice } from "@/lib/voice/analyzeVoice";

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
});
