import { randomUUID } from "node:crypto";
import { parseJsonField, stringifyJsonField } from "@/lib/request";
import type { VoiceSkillFile } from "@/lib/types";
import { compileRulesToSkillPatch } from "@/lib/rules/compileRulesToSkillPatch";
import type { BrandRuleSelectionInput, RuleBankRuleInput, RuleCategoryValue, RuleModeValue, RulePayload, RuleScopeValue, RuleTargetValue } from "@/lib/rules/types";
import { parseRulePayload, parseRuleTargets, RULE_CATEGORIES, RULE_MODES, RULE_SCOPES, RULE_TARGETS } from "@/lib/rules/types";
import { nextSkillVersion } from "@/lib/voice/versioning";

type PrismaLike = Record<string, any>;

type RawRule = {
  id: string;
  title: string;
  body: string;
  category: string;
  mode: string;
  source: string;
  scope: string;
  brandId?: string | null;
  userProfileId?: string | null;
  targetJson: string;
  payloadJson: string;
  enabled: boolean;
};

function enumToValue(value: string) {
  return value.toLowerCase();
}

function toEnum(value: string) {
  return value.toUpperCase();
}

function customRuleId() {
  return `custom-${randomUUID()}`;
}

function toRuleInput(rule: RawRule): RuleBankRuleInput {
  return {
    id: rule.id,
    title: rule.title,
    body: rule.body,
    category: enumToValue(rule.category) as RuleCategoryValue,
    mode: enumToValue(rule.mode) as RuleModeValue,
    source: enumToValue(rule.source) as "starter" | "custom",
    scope: enumToValue(rule.scope) as RuleScopeValue,
    brandId: rule.brandId,
    userProfileId: rule.userProfileId,
    targetJson: parseRuleTargets(rule.targetJson),
    payloadJson: parseRulePayload(rule.payloadJson),
    enabled: rule.enabled,
  };
}

function validateRuleInput(input: {
  title: string;
  body: string;
  category: RuleCategoryValue;
  mode: RuleModeValue;
  scope: RuleScopeValue;
  targetJson: RuleTargetValue[];
  payloadJson: RulePayload;
}) {
  if (!input.title?.trim()) throw new Error("Rule title is required.");
  if (!input.body?.trim()) throw new Error("Rule body is required.");
  if (!RULE_CATEGORIES.includes(input.category)) throw new Error("Rule category is invalid.");
  if (!RULE_MODES.includes(input.mode)) throw new Error("Rule mode is invalid.");
  if (!RULE_SCOPES.includes(input.scope)) throw new Error("Rule scope is invalid.");
  if (!input.targetJson?.length || input.targetJson.some((target) => !RULE_TARGETS.includes(target))) {
    throw new Error("Rule target is invalid.");
  }
  if (input.mode === "banned_phrase" && !(input.payloadJson.phrases ?? []).some((phrase) => phrase.trim())) {
    throw new Error("Banned phrase rules require at least one phrase.");
  }
}

function globalRulesWhere(profileId: string) {
  return {
    scope: "GLOBAL",
    OR: [{ source: "STARTER" }, { source: "CUSTOM", userProfileId: profileId }],
  };
}

function applicableBrandRulesWhere(brandId: string, profileId: string) {
  return {
    enabled: true,
    OR: [{ scope: "GLOBAL", source: "STARTER" }, { scope: "GLOBAL", source: "CUSTOM", userProfileId: profileId }, { brandId }],
  };
}

export async function listApplicableBrandRules({ prisma, brandId, profileId }: { prisma: PrismaLike; brandId: string; profileId: string }) {
  const [rules, selections, applications, latestSkillFile] = await Promise.all([
    prisma.ruleBankRule.findMany({
      where: applicableBrandRulesWhere(brandId, profileId),
      orderBy: [{ source: "asc" }, { category: "asc" }, { title: "asc" }],
    }),
    prisma.brandRuleSelection.findMany({ where: { brandId } }),
    prisma.ruleApplication.findMany({ where: { brandId }, orderBy: { createdAt: "desc" }, take: 8 }),
    prisma.skillFile.findFirst({ where: { brandId }, orderBy: { createdAt: "desc" }, select: { id: true, version: true, createdAt: true } }),
  ]);

  return { rules: rules.map(toRuleInput), selections, applications, latestSkillFile };
}

export async function listGlobalRules({ prisma, profileId }: { prisma: PrismaLike; profileId: string }) {
  const rules = await prisma.ruleBankRule.findMany({
    where: globalRulesWhere(profileId),
    orderBy: [{ source: "asc" }, { category: "asc" }, { title: "asc" }],
  });
  return rules.map(toRuleInput);
}

export async function createCustomRule({
  prisma,
  brandId,
  profileId,
  input,
}: {
  prisma: PrismaLike;
  brandId?: string;
  profileId?: string;
  input: {
    title: string;
    body: string;
    category: RuleCategoryValue;
    mode: RuleModeValue;
    scope: RuleScopeValue;
    targetJson: RuleTargetValue[];
    payloadJson: RulePayload;
  };
}) {
  const scope = brandId ? "brand" : input.scope;
  if (scope === "brand" && !brandId) throw new Error("Brand-scoped rules require a brand.");
  validateRuleInput({ ...input, scope });
  if (scope === "global" && !profileId) throw new Error("User profile is required for global custom rules.");

  const rule = await prisma.ruleBankRule.create({
    data: {
      id: customRuleId(),
      title: input.title.trim(),
      body: input.body.trim(),
      category: toEnum(input.category),
      mode: toEnum(input.mode),
      source: "CUSTOM",
      scope: toEnum(scope),
      brandId: brandId ?? null,
      userProfileId: scope === "global" ? profileId : null,
      targetJson: stringifyJsonField(input.targetJson),
      payloadJson: stringifyJsonField(input.payloadJson),
      enabled: true,
    },
  });

  return toRuleInput(rule);
}

export async function updateCustomRule({
  prisma,
  ruleId,
  brandId,
  profileId,
  input,
}: {
  prisma: PrismaLike;
  ruleId: string;
  brandId?: string;
  profileId?: string;
  input: Parameters<typeof createCustomRule>[0]["input"];
}) {
  validateRuleInput(input);
  const existing = await prisma.ruleBankRule.findUnique({ where: { id: ruleId } });
  if (!existing || enumToValue(existing.source) !== "custom") throw new Error("Only custom rules can be edited.");
  if (brandId && existing.brandId !== brandId) throw new Error("Rule does not belong to this brand.");
  if (!brandId && enumToValue(existing.scope) !== "global") throw new Error("Only global custom rules can be edited here.");
  if (!brandId && (!profileId || existing.userProfileId !== profileId)) throw new Error("Only your custom rules can be edited here.");

  const rule = await prisma.ruleBankRule.update({
    where: { id: ruleId },
    data: {
      title: input.title.trim(),
      body: input.body.trim(),
      category: toEnum(input.category),
      mode: toEnum(input.mode),
      targetJson: stringifyJsonField(input.targetJson),
      payloadJson: stringifyJsonField(input.payloadJson),
    },
  });
  return toRuleInput(rule);
}

export async function saveBrandRuleSelections({
  prisma,
  brandId,
  selections,
}: {
  prisma: PrismaLike;
  brandId: string;
  selections: { ruleId: string; selected: boolean; overrideJson?: unknown }[];
}) {
  await Promise.all(
    selections.map((selection) =>
      prisma.brandRuleSelection.upsert({
        where: { brandId_ruleId: { brandId, ruleId: selection.ruleId } },
        update: { selected: selection.selected, overrideJson: selection.overrideJson ? stringifyJsonField(selection.overrideJson) : null },
        create: {
          brandId,
          ruleId: selection.ruleId,
          selected: selection.selected,
          overrideJson: selection.overrideJson ? stringifyJsonField(selection.overrideJson) : null,
        },
      }),
    ),
  );
  return { ok: true };
}

async function selectedRulesForBrand(prisma: PrismaLike, brandId: string, profileId: string) {
  const selections = await prisma.brandRuleSelection.findMany({ where: { brandId, selected: true } });
  const selectedIds = selections.map((selection: { ruleId: string }) => selection.ruleId);
  const rules = selectedIds.length
    ? await prisma.ruleBankRule.findMany({ where: { id: { in: selectedIds }, ...applicableBrandRulesWhere(brandId, profileId) } })
    : [];
  const normalizedSelections: BrandRuleSelectionInput[] = selections.map((selection: { ruleId: string; selected: boolean; overrideJson?: string | null }) => ({
    brandId,
    ruleId: selection.ruleId,
    selected: selection.selected,
    overrideJson: parseJsonField(selection.overrideJson, null),
  }));

  return { rules: rules.map(toRuleInput), selections: normalizedSelections };
}

export async function previewSelectedRules({ prisma, brandId, profileId, nextVersion }: { prisma: PrismaLike; brandId: string; profileId: string; nextVersion?: string }) {
  const latest = await prisma.skillFile.findFirst({ where: { brandId }, orderBy: { createdAt: "desc" } });
  if (!latest) throw new Error("Create a Skill File before previewing rules.");
  const skillFile = parseJsonField<VoiceSkillFile | null>(latest.skillJson, null);
  if (!skillFile) throw new Error("Latest Skill File could not be parsed.");

  const selected = await selectedRulesForBrand(prisma, brandId, profileId);
  const compiled = compileRulesToSkillPatch({
    skillFile,
    rules: selected.rules,
    selections: selected.selections,
    nextVersion: nextVersion ?? nextSkillVersion(latest.version),
  });
  const preview = await prisma.ruleApplication.create({
    data: {
      brandId,
      status: "PREVIEWED",
      selectedRuleIdsJson: stringifyJsonField(compiled.selectedRuleIds),
      previewPatchJson: stringifyJsonField(compiled),
      baseSkillFileId: latest.id,
      baseSkillFileVersion: latest.version,
    },
  });

  return { preview, compiled };
}

export async function applyRulePreview({ prisma, brandId, previewId }: { prisma: PrismaLike; brandId: string; previewId: string }) {
  const preview = await prisma.ruleApplication.findUnique({ where: { id: previewId } });
  if (!preview || preview.brandId !== brandId) throw new Error("Preview not found.");
  if (preview.status !== "PREVIEWED") throw new Error("Preview has already been applied or discarded.");

  const latest = await prisma.skillFile.findFirst({ where: { brandId }, orderBy: { createdAt: "desc" } });
  if (!latest || latest.id !== preview.baseSkillFileId || latest.version !== preview.baseSkillFileVersion) {
    throw new Error("Preview is stale. Preview again against the latest Skill File.");
  }

  const compiled = parseJsonField<{ nextSkillFile: VoiceSkillFile; items?: string[] } | null>(preview.previewPatchJson, null);
  if (!compiled?.nextSkillFile) throw new Error("Preview patch could not be parsed.");
  if (!compiled.items?.length) {
    throw new Error("Preview has no Skill File changes to apply.");
  }

  const writeApplication = async (client: PrismaLike) => {
    const skillFile = await client.skillFile.create({
      data: {
        brandId,
        version: compiled.nextSkillFile.version,
        skillJson: stringifyJsonField(compiled.nextSkillFile),
      },
    });
    const application = await client.ruleApplication.update({
      where: { id: preview.id },
      data: { status: "APPLIED", resultSkillFileId: skillFile.id, appliedAt: new Date() },
    });

    return { skillFile, application };
  };

  if (typeof prisma.$transaction === "function") {
    return prisma.$transaction((tx: PrismaLike) => writeApplication(tx));
  }

  return writeApplication(prisma);
}
