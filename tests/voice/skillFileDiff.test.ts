import { describe, expect, it } from "vitest";
import type { VoiceSkillFile } from "@/lib/types";
import { diffSkillFiles } from "@/lib/voice/skillFileDiff";

const base = {
  version: "v1.0",
  linguisticRules: ["Use concrete language."],
  preferredPhrases: ["specific"],
  avoidedPhrases: ["game-changing"],
  rules: [{ id: "r1", layer: "mechanics", rule: "Use concrete language.", confidence: 80, supportingExamples: [], counterExamples: [], appliesTo: ["all"] }],
  exampleLibrary: { onBrand: [], offBrand: [], approvedGenerated: [], rejectedGenerated: [] },
} as VoiceSkillFile;

describe("diffSkillFiles", () => {
  it("summarizes meaningful changes between Skill File versions", () => {
    const diff = diffSkillFiles({
      previous: base,
      current: {
        ...base,
        version: "v1.1",
        linguisticRules: ["Use concrete language.", "Do not use em dashes."],
        preferredPhrases: ["specific", "permissionless"],
        avoidedPhrases: ["game-changing", "—"],
        rules: [
          ...(base.rules ?? []),
          { id: "r2", layer: "feedback", rule: "Reject full stop endings.", confidence: 84, supportingExamples: [], counterExamples: [], appliesTo: ["all"] },
        ],
        exampleLibrary: {
          ...base.exampleLibrary,
          rejectedGenerated: ["Efficient distribution. Full stop."],
        },
      },
    });

    expect(diff.title).toBe("v1.0 -> v1.1");
    expect(diff.items).toContain("Added linguistic rule: Do not use em dashes.");
    expect(diff.items).toContain("Added avoided phrase: —");
    expect(diff.items).toContain("Added preferred phrase: permissionless");
    expect(diff.items).toContain("Added structured rule: Reject full stop endings.");
    expect(diff.items).toContain("Rejected examples: +1");
  });
});
