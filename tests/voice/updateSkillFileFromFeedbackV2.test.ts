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

  it("saves note-only feedback without approving or rejecting the generated draft", () => {
    const next = updateSkillFileFromFeedback({
      skillFile: base,
      nextVersion: "v1.1",
      generatedText: "Solana just got programmable incentives.",
      label: "Save note only",
      comment: "Use fewer emojis and mention LPs when relevant.",
    });

    expect(next.exampleLibrary.approvedGenerated).toEqual([]);
    expect(next.exampleLibrary.rejectedGenerated).toEqual([]);
    expect(next.rules?.some((rule) => rule.rule.includes("Use fewer emojis and mention LPs"))).toBe(true);
    expect(next.rules?.some((rule) => rule.rule.includes("Use fewer emojis") && rule.counterExamples.length === 0)).toBe(true);
  });

  it("converts natural language note feedback into enforceable mechanics rules", () => {
    const next = updateSkillFileFromFeedback({
      skillFile: base,
      nextVersion: "v1.1",
      generatedText: "Solana just got programmable incentives — protocols can launch campaigns permissionlessly.",
      label: "Save note only",
      comment: "Please don't use em-dashes in our tweets.",
    });

    expect(next.linguisticRules).toContain("Do not use em dashes in generated tweets. Use commas, periods, colons, or shorter sentences instead.");
    expect(next.avoidedPhrases).toContain("—");
    expect(next.rules?.some((rule) => rule.layer === "mechanics" && rule.rule.includes("Do not use em dashes"))).toBe(true);
    expect(next.exampleLibrary.rejectedGenerated).toEqual([]);
  });

  it("explicitly rejects a generated draft as a counterexample", () => {
    const next = updateSkillFileFromFeedback({
      skillFile: base,
      nextVersion: "v1.1",
      generatedText: "Solana just got programmable incentives. 🟣",
      label: "Reject draft",
      comment: "This is too thin and too emoji-heavy.",
    });

    expect(next.exampleLibrary.approvedGenerated).toEqual([]);
    expect(next.exampleLibrary.rejectedGenerated).toContain("Solana just got programmable incentives. 🟣");
    expect(next.rules?.some((rule) => rule.rule.includes("Reject drafts like this") && rule.counterExamples.includes("Solana just got programmable incentives. 🟣"))).toBe(true);
  });
});
