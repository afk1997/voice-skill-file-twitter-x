import { describe, expect, it } from "vitest";
import { createVoiceSkillFile } from "@/lib/voice/createSkillFile";
import type { VoiceReport } from "@/lib/types";

const report: VoiceReport = {
  summary: "Direct, specific, builder-focused voice.",
  personalityTraits: ["direct", "practical"],
  toneSliders: {
    formalToCasual: 72,
    seriousToFunny: 35,
    respectfulToIrreverent: 30,
    enthusiasticToMatterOfFact: 65,
    simpleToComplex: 42,
    warmToDetached: 60,
  },
  linguisticMechanics: {
    averageTweetLength: 118,
    sentenceLength: "medium",
    usesEmojis: false,
    emojiFrequency: "none",
    punctuationStyle: "clean periods and occasional question marks",
    capitalizationStyle: "sentence case",
    lineBreakStyle: "short paragraphs",
    firstPersonUsage: "medium",
    secondPersonUsage: "medium",
  },
  hookPatterns: ["Start with a sharp claim"],
  endingPatterns: ["End with a practical takeaway"],
  preferredPhrases: ["specific beats generic"],
  avoidedPhrases: ["game-changing"],
  contentPatterns: [{ name: "Practical lesson", description: "Teaches from experience", structure: "claim -> example -> takeaway" }],
  exampleTweets: ["Specific examples beat vague advice because they give the reader something to copy."],
};

describe("createVoiceSkillFile", () => {
  it("builds the four-layer skill file from brand and report data", () => {
    const skill = createVoiceSkillFile({
      version: "v1.0",
      brand: {
        name: "Acme",
        audience: "founders, operators",
        beliefs: "specific beats generic\nshipping teaches faster than planning",
        avoidSoundingLike: "corporate launch copy",
      },
      report,
    });

    expect(skill.version).toBe("v1.0");
    expect(skill.brandName).toBe("Acme");
    expect(skill.coreBeliefs).toContain("specific beats generic");
    expect(skill.coreVoiceIdentity.thisNotThat[0]).toEqual({ this: "direct", notThat: "corporate launch copy" });
    expect(skill.exampleLibrary.onBrand).toHaveLength(1);
  });
});
