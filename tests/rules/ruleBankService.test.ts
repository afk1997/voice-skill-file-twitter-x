import { describe, expect, it, vi } from "vitest";
import { applyRulePreview, createCustomRule, listGlobalRules, previewSelectedRules, saveBrandRuleSelections } from "@/lib/rules/ruleBankService";

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

  it("generates ids for custom rules created at runtime", async () => {
    const create = vi.fn(async ({ data }) => data);
    const rule = await createCustomRule({
      prisma: { ruleBankRule: { create } },
      profileId: "profile1",
      input: {
        title: "Custom rule",
        body: "Use one concrete observed consequence.",
        category: "specificity",
        mode: "guidance",
        scope: "global",
        targetJson: ["skill_rules"],
        payloadJson: {},
      },
    });

    expect(create.mock.calls[0][0].data.id).toMatch(/^custom-[0-9a-f-]{36}$/);
    expect(create.mock.calls[0][0].data.userProfileId).toBe("profile1");
    expect(rule.id).toBe(create.mock.calls[0][0].data.id);
  });

  it("lists starter rules plus global custom rules owned by the profile", async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    await listGlobalRules({ prisma: { ruleBankRule: { findMany } }, profileId: "profile1" } as never);

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          scope: "GLOBAL",
          OR: [{ source: "STARTER" }, { source: "CUSTOM", userProfileId: "profile1" }],
        },
      }),
    );
  });

  it("stores profile ownership on custom global rules", async () => {
    const create = vi.fn(async ({ data }) => ({ ...data, brandId: null, enabled: true }));
    const rule = await createCustomRule({
      prisma: { ruleBankRule: { create } },
      profileId: "profile1",
      input: {
        title: "Custom",
        body: "Use concrete anchors.",
        category: "specificity",
        mode: "guidance",
        scope: "global",
        targetJson: ["skill_rules"],
        payloadJson: {},
      },
    } as never);

    expect(create.mock.calls[0][0].data.userProfileId).toBe("profile1");
    expect(rule.source).toBe("custom");
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
      profileId: "profile1",
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

  it("rejects no-op previews during apply", async () => {
    await expect(
      applyRulePreview({
        prisma: {
          ruleApplication: {
            findUnique: vi.fn().mockResolvedValue({
              id: "preview1",
              brandId: "b1",
              baseSkillFileId: "sf1",
              baseSkillFileVersion: "v1.0",
              status: "PREVIEWED",
              previewPatchJson: JSON.stringify({ items: [], nextSkillFile: { version: "v1.1" } }),
            }),
          },
          skillFile: { findFirst: vi.fn().mockResolvedValue({ id: "sf1", version: "v1.0" }) },
        },
        brandId: "b1",
        previewId: "preview1",
      } as never),
    ).rejects.toThrow("Preview has no Skill File changes to apply.");
  });

  it("applies previews inside a transaction when available", async () => {
    const createSkillFile = vi.fn().mockResolvedValue({ id: "sf2", version: "v1.1" });
    const updateApplication = vi.fn().mockResolvedValue({ id: "preview1", status: "APPLIED" });
    const transaction = vi.fn(async (callback) =>
      callback({
        skillFile: { create: createSkillFile },
        ruleApplication: { update: updateApplication },
      }),
    );

    const result = await applyRulePreview({
      prisma: {
        $transaction: transaction,
        ruleApplication: {
          findUnique: vi.fn().mockResolvedValue({
            id: "preview1",
            brandId: "b1",
            baseSkillFileId: "sf1",
            baseSkillFileVersion: "v1.0",
            status: "PREVIEWED",
            previewPatchJson: JSON.stringify({ items: ["Added rule"], nextSkillFile: { version: "v1.1" } }),
          }),
        },
        skillFile: { findFirst: vi.fn().mockResolvedValue({ id: "sf1", version: "v1.0" }) },
      },
      brandId: "b1",
      previewId: "preview1",
    } as never);

    expect(transaction).toHaveBeenCalledOnce();
    expect(createSkillFile).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ version: "v1.1" }) }));
    expect(updateApplication).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "preview1" }, data: expect.objectContaining({ status: "APPLIED" }) }));
    expect(result.skillFile.version).toBe("v1.1");
  });
});
