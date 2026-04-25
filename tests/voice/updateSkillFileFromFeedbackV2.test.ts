import { describe, expect, it } from "vitest";
import type { VoiceSkillFile } from "@/lib/types";
import { updateSkillFileFromFeedback } from "@/lib/voice/updateSkillFileFromFeedback";

const base = {
  version: "v1.0",
  linguisticRules: [],
  preferredPhrases: [],
  avoidedPhrases: [],
  rules: [],
  retrievalHints: { preferredTopics: [], preferredStructures: [], preferredVocabulary: [], avoidVocabulary: [] },
  exampleLibrary: { onBrand: [], offBrand: [], approvedGenerated: [], rejectedGenerated: [] },
} as unknown as VoiceSkillFile;

describe("updateSkillFileFromFeedback v2", () => {
  it("promotes approved generated drafts and adds a feedback rule", () => {
    const next = updateSkillFileFromFeedback({
      skillFile: base,
      nextVersion: "v1.1",
      generatedText: "Specific rewards beat vague campaigns.",
      label: "Sounds like us",
    });

    expect(next.exampleLibrary.approvedGenerated).toContain("Specific rewards beat vague campaigns.");
    expect(next.rules?.some((rule) => rule.layer === "feedback" && rule.supportingExamples.includes("Specific rewards beat vague campaigns."))).toBe(true);
  });

  it("stores rejected drafts as counterexamples and avoids wrong vocabulary", () => {
    const next = updateSkillFileFromFeedback({
      skillFile: base,
      nextVersion: "v1.1",
      generatedText: "We are excited to announce seamless liquidity.",
      label: "Wrong vocabulary",
      comment: "seamless liquidity",
    });

    expect(next.exampleLibrary.rejectedGenerated).toContain("We are excited to announce seamless liquidity.");
    expect(next.retrievalHints?.avoidVocabulary).toContain("seamless liquidity");
    expect(next.rules?.some((rule) => rule.counterExamples.includes("We are excited to announce seamless liquidity."))).toBe(true);
  });
});
