import { describe, expect, it } from "vitest";
import { compileFeedbackToSkillPatch } from "@/lib/voice/compileFeedback";

describe("compileFeedbackToSkillPatch", () => {
  it("turns punctuation feedback into durable skill-file rules", () => {
    const patch = compileFeedbackToSkillPatch({
      label: "Save note only",
      comment: "Please don't use em-dashes in our tweets.",
      generatedText: "Solana just got programmable incentives — protocols can launch campaigns permissionlessly.",
    });

    expect(patch.addedRules).toContain("Do not use em dashes in generated tweets. Use commas, periods, colons, or shorter sentences instead.");
    expect(patch.avoidedPhrases).toContain("—");
    expect(patch.ruleLayer).toBe("mechanics");
    expect(patch.rejectedExamples).toEqual([]);
  });

  it("keeps explicit rejection separate from neutral notes", () => {
    const patch = compileFeedbackToSkillPatch({
      label: "Reject draft",
      comment: "Good idea, but too vague and too polished.",
      generatedText: "We are excited to announce seamless liquidity for everyone.",
    });

    expect(patch.rejectedExamples).toContain("We are excited to announce seamless liquidity for everyone.");
    expect(patch.addedRules).toContain("Reject drafts like this and use them as off-brand counterexamples.");
    expect(patch.addedRules).toContain("Avoid polished corporate announcement language.");
  });
});
