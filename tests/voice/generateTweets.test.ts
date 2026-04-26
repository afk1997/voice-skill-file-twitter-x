import { describe, expect, it } from "vitest";
import { generateTweets } from "@/lib/voice/generateTweets";
import type { VoiceSkillFile } from "@/lib/types";

const skillFile = {
  brandName: "Acme",
  voiceSummary: "Direct and practical",
  preferredPhrases: ["specific beats generic"],
  avoidedPhrases: ["game-changing"],
  exampleLibrary: {
    onBrand: ["Specific examples beat vague advice because readers can copy the move."],
    offBrand: [],
    approvedGenerated: [],
    rejectedGenerated: [],
  },
  linguisticRules: ["Use concrete language."],
} as VoiceSkillFile;

describe("generateTweets", () => {
  it("requires a real LLM provider instead of silently returning placeholder generations", async () => {
    await expect(
      generateTweets({
        context: "turning archive tweets into a reusable voice file",
        tweetType: "single tweet",
        variations: 3,
        notes: "",
        skillFile,
        examples: ["Specific examples beat vague advice because readers can copy the move."],
        providerConfig: {},
      }),
    ).rejects.toThrow("A real LLM provider is required");
  });
});
