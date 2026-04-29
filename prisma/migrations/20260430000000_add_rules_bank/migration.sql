CREATE TYPE "RuleSource" AS ENUM ('starter', 'custom');
CREATE TYPE "RuleScope" AS ENUM ('global', 'brand');
CREATE TYPE "RuleMode" AS ENUM ('guidance', 'hard_constraint', 'banned_phrase', 'retrieval_hint');
CREATE TYPE "RuleCategory" AS ENUM ('format_fit', 'specificity', 'fact_discipline', 'regularity', 'plain_language', 'formula_phrases', 'accessibility', 'stance_voice', 'provenance');
CREATE TYPE "RuleTarget" AS ENUM ('skill_rules', 'linguistic_rules', 'avoided_phrases', 'retrieval_preferred_topics', 'retrieval_preferred_structures', 'retrieval_preferred_vocabulary', 'retrieval_avoid_vocabulary');
CREATE TYPE "RuleApplicationStatus" AS ENUM ('previewed', 'applied', 'discarded');

CREATE TABLE "RuleBankRule" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "category" "RuleCategory" NOT NULL,
    "mode" "RuleMode" NOT NULL,
    "source" "RuleSource" NOT NULL,
    "scope" "RuleScope" NOT NULL,
    "brandId" TEXT,
    "targetJson" TEXT NOT NULL,
    "payloadJson" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "RuleBankRule_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BrandRuleSelection" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "ruleId" TEXT NOT NULL,
    "selected" BOOLEAN NOT NULL DEFAULT false,
    "overrideJson" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "BrandRuleSelection_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RuleApplication" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "status" "RuleApplicationStatus" NOT NULL,
    "selectedRuleIdsJson" TEXT NOT NULL,
    "previewPatchJson" TEXT NOT NULL,
    "baseSkillFileId" TEXT NOT NULL,
    "baseSkillFileVersion" TEXT NOT NULL,
    "resultSkillFileId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "appliedAt" TIMESTAMP(3),
    CONSTRAINT "RuleApplication_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "RuleBankRule_source_scope_enabled_idx" ON "RuleBankRule"("source", "scope", "enabled");
CREATE INDEX "RuleBankRule_brandId_idx" ON "RuleBankRule"("brandId");
CREATE UNIQUE INDEX "BrandRuleSelection_brandId_ruleId_key" ON "BrandRuleSelection"("brandId", "ruleId");
CREATE INDEX "BrandRuleSelection_brandId_selected_idx" ON "BrandRuleSelection"("brandId", "selected");
CREATE INDEX "RuleApplication_brandId_createdAt_idx" ON "RuleApplication"("brandId", "createdAt");
CREATE INDEX "RuleApplication_status_idx" ON "RuleApplication"("status");

ALTER TABLE "RuleBankRule" ADD CONSTRAINT "RuleBankRule_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BrandRuleSelection" ADD CONSTRAINT "BrandRuleSelection_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BrandRuleSelection" ADD CONSTRAINT "BrandRuleSelection_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "RuleBankRule"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RuleApplication" ADD CONSTRAINT "RuleApplication_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RuleApplication" ADD CONSTRAINT "RuleApplication_baseSkillFileId_fkey" FOREIGN KEY ("baseSkillFileId") REFERENCES "SkillFile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RuleApplication" ADD CONSTRAINT "RuleApplication_resultSkillFileId_fkey" FOREIGN KEY ("resultSkillFileId") REFERENCES "SkillFile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
