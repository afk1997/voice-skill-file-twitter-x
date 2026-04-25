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
  it("returns scored mock variations without provider credentials", async () => {
    const results = await generateTweets({
      context: "turning archive tweets into a reusable voice file",
      tweetType: "single tweet",
      variations: 3,
      notes: "",
      skillFile,
      examples: ["Specific examples beat vague advice because readers can copy the move."],
      providerConfig: {},
    });

    expect(results).toHaveLength(3);
    expect(results[0].text).toContain("voice file");
    expect(results[0].score).toBeGreaterThan(0);
  });
});
