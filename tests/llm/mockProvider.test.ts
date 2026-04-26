import { describe, expect, it } from "vitest";
import type { VoiceSkillFile } from "@/lib/types";
import { mockGeneratedTweets } from "@/lib/llm/mockProvider";

describe("mockGeneratedTweets", () => {
  it("revises the supplied draft instead of returning a generic placeholder", () => {
    const results = mockGeneratedTweets({
      context: `Original request:
Announce Solana launch.

Draft to revise:
Solana just got programmable incentives — set targets.

Feedback already applied to the latest Skill File:
1. Save note only: Please don't use em-dashes.

Return one improved replacement for the draft.`,
      tweetType: "single tweet",
      variations: 1,
      skillFile: {
        brandName: "Metrom",
        avoidedPhrases: ["—"],
        linguisticRules: ["Do not use em dashes in generated tweets. Use commas, periods, colons, or shorter sentences instead."],
        exampleLibrary: { onBrand: [], offBrand: [], approvedGenerated: [], rejectedGenerated: [] },
      } as VoiceSkillFile,
    });

    expect(results[0].text).toContain("Solana just got programmable incentives");
    expect(results[0].text).not.toContain("—");
    expect(results[0].text).not.toContain("voice rule");
  });
});
