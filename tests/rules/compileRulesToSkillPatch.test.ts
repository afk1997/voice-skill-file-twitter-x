import { describe, expect, it } from "vitest";
import type { VoiceSkillFile } from "@/lib/types";
import { compileRulesToSkillPatch } from "@/lib/rules/compileRulesToSkillPatch";
import type { RuleBankRuleInput } from "@/lib/rules/types";

const baseSkillFile = {
  version: "v1.0",
  brandName: "Metrom",
  voiceSummary: "Direct and specific.",
  linguisticRules: ["Use concrete language."],
  preferredPhrases: [],
  avoidedPhrases: ["game-changing"],
  rules: [],
  retrievalHints: { preferredTopics: [], preferredStructures: [], preferredVocabulary: [], avoidVocabulary: [] },
  exampleLibrary: { onBrand: [], offBrand: [], approvedGenerated: [], rejectedGenerated: [] },
  updatedAt: "2026-04-30T00:00:00.000Z",
} as unknown as VoiceSkillFile;

function rule(input: Partial<RuleBankRuleInput> & Pick<RuleBankRuleInput, "id" | "mode" | "body" | "targetJson">): RuleBankRuleInput {
  return {
    title: input.id,
    category: "specificity",
    source: "custom",
    scope: "global",
    payloadJson: {},
    enabled: true,
    ...input,
  };
}

describe("compileRulesToSkillPatch", () => {
  it("adds hard constraints to linguistic rules and structured rules", () => {
    const compiled = compileRulesToSkillPatch({
      skillFile: baseSkillFile,
      rules: [
        rule({
          id: "r-hard",
          mode: "hard_constraint",
          body: "Do not invent metrics.",
          targetJson: ["skill_rules", "linguistic_rules"],
          payloadJson: { confidence: 95 },
        }),
      ],
      selections: [],
      nextVersion: "v1.1",
    });

    expect(compiled.nextSkillFile.version).toBe("v1.1");
    expect(compiled.nextSkillFile.linguisticRules).toContain("Do not invent metrics.");
    expect(compiled.nextSkillFile.rules?.some((item) => item.id === "bank-r-hard" && item.confidence === 95)).toBe(true);
    expect(compiled.items).toContain("Add hard constraint: Do not invent metrics.");
  });

  it("adds banned phrases to avoided phrases and retrieval avoid vocabulary", () => {
    const compiled = compileRulesToSkillPatch({
      skillFile: baseSkillFile,
      rules: [
        rule({
          id: "r-ban",
          mode: "banned_phrase",
          body: "Avoid formula language.",
          targetJson: ["avoided_phrases", "retrieval_avoid_vocabulary", "skill_rules"],
          payloadJson: { phrases: ["ever-evolving landscape", "game-changing"] },
        }),
      ],
      selections: [],
      nextVersion: "v1.1",
    });

    expect(compiled.nextSkillFile.avoidedPhrases).toContain("ever-evolving landscape");
    expect(compiled.nextSkillFile.avoidedPhrases.filter((phrase) => phrase === "game-changing")).toHaveLength(1);
    expect(compiled.nextSkillFile.retrievalHints?.avoidVocabulary).toContain("ever-evolving landscape");
    expect(compiled.patch.avoidedPhrases).toEqual(["ever-evolving landscape"]);
  });

  it("updates retrieval hint targets", () => {
    const compiled = compileRulesToSkillPatch({
      skillFile: baseSkillFile,
      rules: [
        rule({
          id: "r-retrieval",
          mode: "retrieval_hint",
          body: "Prefer concrete examples.",
          targetJson: ["retrieval_preferred_vocabulary", "retrieval_preferred_structures"],
          payloadJson: { preferredVocabulary: ["specific"], preferredStructures: ["start with observed consequence"] },
        }),
      ],
      selections: [],
      nextVersion: "v1.1",
    });

    expect(compiled.nextSkillFile.retrievalHints?.preferredVocabulary).toContain("specific");
    expect(compiled.nextSkillFile.retrievalHints?.preferredStructures).toContain("start with observed consequence");
  });

  it("uses selected override wording and remains idempotent", () => {
    const selectedRule = rule({
      id: "r-guidance",
      mode: "guidance",
      body: "Use concrete anchors.",
      targetJson: ["skill_rules"],
    });
    const first = compileRulesToSkillPatch({
      skillFile: baseSkillFile,
      rules: [selectedRule],
      selections: [{ brandId: "b1", ruleId: "r-guidance", selected: true, overrideJson: { body: "Use one concrete anchor." } }],
      nextVersion: "v1.1",
    });
    const second = compileRulesToSkillPatch({
      skillFile: first.nextSkillFile,
      rules: [selectedRule],
      selections: [{ brandId: "b1", ruleId: "r-guidance", selected: true, overrideJson: { body: "Use one concrete anchor." } }],
      nextVersion: "v1.2",
    });

    expect(first.nextSkillFile.rules?.map((item) => item.rule)).toContain("Use one concrete anchor.");
    expect(second.nextSkillFile.rules?.filter((item) => item.id === "bank-r-guidance")).toHaveLength(1);
  });
});
