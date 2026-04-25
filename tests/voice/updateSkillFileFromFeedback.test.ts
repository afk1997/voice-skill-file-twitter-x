import { describe, expect, it } from "vitest";
import { updateSkillFileFromFeedback } from "@/lib/voice/updateSkillFileFromFeedback";
import type { VoiceSkillFile } from "@/lib/types";

const baseSkill: VoiceSkillFile = {
  version: "v1.0",
  brandName: "Acme",
  voiceSummary: "Direct and practical",
  audience: [],
  coreBeliefs: [],
  coreVoiceIdentity: { traits: ["direct"], thisNotThat: [] },
  toneSliders: {
    formalToCasual: 70,
    seriousToFunny: 40,
    respectfulToIrreverent: 30,
    enthusiasticToMatterOfFact: 65,
    simpleToComplex: 35,
    warmToDetached: 55,
  },
  linguisticRules: [],
  contextualToneRules: [],
  preferredPhrases: [],
  avoidedPhrases: [],
  tweetPatterns: [],
  exampleLibrary: { onBrand: [], offBrand: [], approvedGenerated: [], rejectedGenerated: [] },
  qualityRubric: {
    brandVoiceMatch: 35,
    twitterNativeness: 20,
    specificity: 15,
    hookQuality: 10,
    nonGeneric: 10,
    ctaFit: 5,
  },
  updatedAt: "2026-04-25T00:00:00.000Z",
};

describe("updateSkillFileFromFeedback", () => {
  it("adds approved examples when feedback says sounds like us", () => {
    const updated = updateSkillFileFromFeedback({
      skillFile: baseSkill,
      nextVersion: "v1.1",
      generatedText: "Specific examples beat vague advice.",
      label: "Sounds like us",
    });

    expect(updated.version).toBe("v1.1");
    expect(updated.exampleLibrary.approvedGenerated).toContain("Specific examples beat vague advice.");
  });

  it("adds specificity rule when feedback says too generic", () => {
    const updated = updateSkillFileFromFeedback({
      skillFile: baseSkill,
      nextVersion: "v1.1",
      generatedText: "Build better products.",
      label: "Too generic",
    });

    expect(updated.linguisticRules).toContain("Prefer specific examples, concrete nouns, and sharper claims over broad advice.");
  });
});
