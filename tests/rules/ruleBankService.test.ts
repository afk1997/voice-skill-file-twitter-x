import { describe, expect, it, vi } from "vitest";
import { applyRulePreview, createCustomRule, previewSelectedRules, saveBrandRuleSelections } from "@/lib/rules/ruleBankService";

describe("ruleBankService", () => {
  it("validates banned phrase custom rules", async () => {
    await expect(
      createCustomRule({
        prisma: {} as never,
        input: {
          title: "Ban empty",
          body: "Avoid empty phrases.",
          category: "formula_phrases",
          mode: "banned_phrase",
          scope: "global",
          targetJson: ["avoided_phrases"],
          payloadJson: { phrases: [] },
        },
      }),
    ).rejects.toThrow("Banned phrase rules require at least one phrase.");
  });

  it("upserts brand selections without creating skill files", async () => {
    const upsert = vi.fn().mockResolvedValue({});
    await saveBrandRuleSelections({
      prisma: { brandRuleSelection: { upsert } },
      brandId: "b1",
      selections: [{ ruleId: "r1", selected: true }],
    });
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { brandId_ruleId: { brandId: "b1", ruleId: "r1" } },
        update: { selected: true, overrideJson: null },
      }),
    );
  });

  it("stores preview applications without creating a skill file", async () => {
    const latestSkill = {
      id: "sf1",
      version: "v1.0",
      skillJson: JSON.stringify({
        version: "v1.0",
        linguisticRules: [],
        avoidedPhrases: [],
        rules: [],
        retrievalHints: { preferredTopics: [], preferredStructures: [], preferredVocabulary: [], avoidVocabulary: [] },
        exampleLibrary: { onBrand: [], offBrand: [], approvedGenerated: [], rejectedGenerated: [] },
      }),
    };
    const create = vi.fn().mockResolvedValue({ id: "preview1" });
    const result = await previewSelectedRules({
      prisma: {
        skillFile: { findFirst: vi.fn().mockResolvedValue(latestSkill) },
        brandRuleSelection: { findMany: vi.fn().mockResolvedValue([{ ruleId: "r1", selected: true, overrideJson: null }]) },
        ruleBankRule: {
          findMany: vi.fn().mockResolvedValue([
            {
              id: "r1",
              title: "Rule",
              body: "Do not invent metrics.",
              category: "FACT_DISCIPLINE",
              mode: "HARD_CONSTRAINT",
              source: "CUSTOM",
              scope: "GLOBAL",
              brandId: null,
              targetJson: JSON.stringify(["skill_rules", "linguistic_rules"]),
              payloadJson: JSON.stringify({ confidence: 95 }),
              enabled: true,
            },
          ]),
        },
        ruleApplication: { create },
      },
      brandId: "b1",
      nextVersion: "v1.1",
    });
    expect(result.preview.id).toBe("preview1");
    expect(create).toHaveBeenCalledOnce();
  });

  it("rejects stale previews during apply", async () => {
    await expect(
      applyRulePreview({
        prisma: {
          ruleApplication: { findUnique: vi.fn().mockResolvedValue({ brandId: "b1", baseSkillFileId: "old", baseSkillFileVersion: "v1.0", status: "PREVIEWED" }) },
          skillFile: { findFirst: vi.fn().mockResolvedValue({ id: "new", version: "v1.2" }) },
        },
        brandId: "b1",
        previewId: "preview1",
      } as never),
    ).rejects.toThrow("Preview is stale. Preview again against the latest Skill File.");
  });
});
