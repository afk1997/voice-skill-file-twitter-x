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

export async function listApplicableBrandRules({ prisma, brandId }: { prisma: PrismaLike; brandId: string }) {
  const [rules, selections, applications, latestSkillFile] = await Promise.all([
    prisma.ruleBankRule.findMany({
      where: { enabled: true, OR: [{ scope: "GLOBAL" }, { brandId }] },
      orderBy: [{ source: "asc" }, { category: "asc" }, { title: "asc" }],
    }),
    prisma.brandRuleSelection.findMany({ where: { brandId } }),
    prisma.ruleApplication.findMany({ where: { brandId }, orderBy: { createdAt: "desc" }, take: 8 }),
    prisma.skillFile.findFirst({ where: { brandId }, orderBy: { createdAt: "desc" }, select: { id: true, version: true, createdAt: true } }),
  ]);

  return { rules: rules.map(toRuleInput), selections, applications, latestSkillFile };
}

export async function listGlobalRules({ prisma }: { prisma: PrismaLike }) {
  const rules = await prisma.ruleBankRule.findMany({
    where: { scope: "GLOBAL" },
    orderBy: [{ source: "asc" }, { category: "asc" }, { title: "asc" }],
  });
  return rules.map(toRuleInput);
}

export async function createCustomRule({
  prisma,
  brandId,
  input,
}: {
  prisma: PrismaLike;
  brandId?: string;
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

  const rule = await prisma.ruleBankRule.create({
    data: {
      title: input.title.trim(),
      body: input.body.trim(),
      category: toEnum(input.category),
      mode: toEnum(input.mode),
      source: "CUSTOM",
      scope: toEnum(scope),
      brandId: brandId ?? null,
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
  input,
}: {
  prisma: PrismaLike;
  ruleId: string;
  brandId?: string;
  input: Parameters<typeof createCustomRule>[0]["input"];
}) {
  validateRuleInput(input);
  const existing = await prisma.ruleBankRule.findUnique({ where: { id: ruleId } });
  if (!existing || enumToValue(existing.source) !== "custom") throw new Error("Only custom rules can be edited.");
  if (brandId && existing.brandId !== brandId) throw new Error("Rule does not belong to this brand.");
  if (!brandId && enumToValue(existing.scope) !== "global") throw new Error("Only global custom rules can be edited here.");

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

async function selectedRulesForBrand(prisma: PrismaLike, brandId: string) {
  const selections = await prisma.brandRuleSelection.findMany({ where: { brandId, selected: true } });
  const selectedIds = selections.map((selection: { ruleId: string }) => selection.ruleId);
  const rules = selectedIds.length
    ? await prisma.ruleBankRule.findMany({ where: { id: { in: selectedIds }, enabled: true, OR: [{ scope: "GLOBAL" }, { brandId }] } })
    : [];
  const normalizedSelections: BrandRuleSelectionInput[] = selections.map((selection: { ruleId: string; selected: boolean; overrideJson?: string | null }) => ({
    brandId,
    ruleId: selection.ruleId,
    selected: selection.selected,
    overrideJson: parseJsonField(selection.overrideJson, null),
  }));

  return { rules: rules.map(toRuleInput), selections: normalizedSelections };
}

export async function previewSelectedRules({ prisma, brandId, nextVersion }: { prisma: PrismaLike; brandId: string; nextVersion?: string }) {
  const latest = await prisma.skillFile.findFirst({ where: { brandId }, orderBy: { createdAt: "desc" } });
  if (!latest) throw new Error("Create a Skill File before previewing rules.");
  const skillFile = parseJsonField<VoiceSkillFile | null>(latest.skillJson, null);
  if (!skillFile) throw new Error("Latest Skill File could not be parsed.");

  const selected = await selectedRulesForBrand(prisma, brandId);
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

  const compiled = parseJsonField<{ nextSkillFile: VoiceSkillFile } | null>(preview.previewPatchJson, null);
  if (!compiled?.nextSkillFile) throw new Error("Preview patch could not be parsed.");

  const skillFile = await prisma.skillFile.create({
    data: {
      brandId,
      version: compiled.nextSkillFile.version,
      skillJson: stringifyJsonField(compiled.nextSkillFile),
    },
  });
  const application = await prisma.ruleApplication.update({
    where: { id: preview.id },
    data: { status: "APPLIED", resultSkillFileId: skillFile.id, appliedAt: new Date() },
  });

  return { skillFile, application };
}
