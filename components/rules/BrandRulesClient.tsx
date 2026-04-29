"use client";

import Link from "next/link";
import React, { useMemo, useState } from "react";
import { RuleForm } from "@/components/rules/RuleForm";
import { RuleList } from "@/components/rules/RuleList";
import type { RuleBankRuleInput } from "@/lib/rules/types";

type BrandRuleSelectionView = {
  ruleId: string;
  selected: boolean;
  overrideJson?: string | null;
};

type RuleApplicationView = {
  id: string;
  status: string;
  baseSkillFileVersion: string;
  appliedAt?: string | Date | null;
  createdAt?: string | Date | null;
};

type LatestSkillFileView = {
  id: string;
  version: string;
  createdAt?: string | Date;
} | null;

type PreviewState = {
  preview: { id: string };
  compiled: {
    items: string[];
    nextSkillFile?: { version?: string };
    patch?: {
      linguisticRules?: string[];
      avoidedPhrases?: string[];
      skillRules?: unknown[];
      retrievalHints?: {
        preferredTopics?: string[];
        preferredStructures?: string[];
        preferredVocabulary?: string[];
        avoidVocabulary?: string[];
      };
    };
  };
};

export function BrandRulesClient({
  brandId,
  initialRules,
  initialSelections,
  applications,
  latestSkillFile,
}: {
  brandId: string;
  initialRules: RuleBankRuleInput[];
  initialSelections: BrandRuleSelectionView[];
  applications: RuleApplicationView[];
  latestSkillFile: LatestSkillFileView;
}) {
  const [rules, setRules] = useState(initialRules);
  const [selectedRuleIds, setSelectedRuleIds] = useState(() => initialSelections.filter((selection) => selection.selected).map((selection) => selection.ruleId));
  const [editingRule, setEditingRule] = useState<RuleBankRuleInput | null>(null);
  const [preview, setPreview] = useState<PreviewState | null>(null);
  const [appliedVersion, setAppliedVersion] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState("");
  const selectedCount = selectedRuleIds.length;

  const applicationItems = useMemo(
    () =>
      applications.map((application) => ({
        ...application,
        label: `${application.status.toLowerCase()} against ${application.baseSkillFileVersion}`,
      })),
    [applications],
  );

  function saveRule(rule: RuleBankRuleInput) {
    setRules((current) => (current.some((item) => item.id === rule.id) ? current.map((item) => (item.id === rule.id ? rule : item)) : [rule, ...current]));
    setEditingRule(null);
    setPreview(null);
    setAppliedVersion("");
  }

  async function saveSelection(ruleId: string, selected: boolean) {
    const previousSelected = selectedRuleIds;
    const nextSelected = selected ? Array.from(new Set([...selectedRuleIds, ruleId])) : selectedRuleIds.filter((id) => id !== ruleId);
    setSelectedRuleIds(nextSelected);
    setPreview(null);
    setAppliedVersion("");
    setError("");

    const response = await fetch(`/api/brands/${brandId}/rules/selections`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ selections: [{ ruleId, selected }] }),
    });
    const json = await response.json();
    if (!response.ok) {
      setSelectedRuleIds(previousSelected);
      setError(json.error || "Could not save rule selection.");
    }
  }

  async function previewRules() {
    setLoading("preview");
    setError("");
    setAppliedVersion("");
    const response = await fetch(`/api/brands/${brandId}/rules/preview`, { method: "POST" });
    const json = await response.json();
    setLoading("");
    if (!response.ok) {
      setError(json.error || "Could not preview rules.");
      return;
    }
    setPreview(json);
  }

  async function applyRules() {
    if (!preview?.preview.id) return;
    setLoading("apply");
    setError("");
    const response = await fetch(`/api/brands/${brandId}/rules/apply`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ previewId: preview.preview.id }),
    });
    const json = await response.json();
    setLoading("");
    if (!response.ok) {
      setError(json.error || "Could not apply rules.");
      return;
    }
    setAppliedVersion(json.skillFile?.version || preview.compiled.nextSkillFile?.version || "");
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
      <section className="space-y-4">
        <RuleForm brandId={brandId} onSaved={saveRule} editingRule={editingRule} onCancelEdit={() => setEditingRule(null)} />
        <RuleList rules={rules} selectedRuleIds={selectedRuleIds} onSelectionChange={saveSelection} onEdit={setEditingRule} />
      </section>

      <aside className="h-fit space-y-4 spool-plate p-5">
        <div>
          <p className="text-xs font-semibold uppercase text-muted">Selection</p>
          <h2 className="mt-1 text-xl font-semibold text-ink">{selectedCount} selected</h2>
          <p className="mt-2 text-sm leading-6 text-muted">
            {latestSkillFile ? `Preview against ${latestSkillFile.version}.` : "Create a Skill File before previewing or applying rules."}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={previewRules} disabled={!latestSkillFile || selectedCount === 0 || loading !== ""} className="spool-button disabled:opacity-60">
            {loading === "preview" ? "Previewing..." : "Preview"}
          </button>
          <button type="button" onClick={applyRules} disabled={!preview || preview.compiled.items.length === 0 || loading !== ""} className="spool-button-secondary disabled:opacity-60">
            {loading === "apply" ? "Applying..." : "Apply to Skill File"}
          </button>
        </div>

        {error ? <p className="text-sm text-weak">{error}</p> : null}

        {preview ? (
          <div className="spool-plate-soft p-4">
            <p className="text-xs font-semibold uppercase text-muted">Preview</p>
            <h3 className="mt-1 font-semibold text-ink">Next version {preview.compiled.nextSkillFile?.version || "ready"}</h3>
            <ul className="mt-3 space-y-2 text-sm leading-6 text-muted">
              {preview.compiled.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            {preview.compiled.items.length === 0 ? <p className="mt-2 text-sm text-muted">No new Skill File changes from the current selection.</p> : null}
          </div>
        ) : null}

        {appliedVersion ? (
          <div className="spool-plate-soft p-4">
            <p className="text-sm font-medium text-good">Applied {appliedVersion}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Link href={`/brands/${brandId}/skill-file`} className="spool-button-secondary text-sm">
                Open Skill File
              </Link>
              <Link href={`/brands/${brandId}/studio`} className="spool-button text-sm">
                Open Studio
              </Link>
            </div>
          </div>
        ) : null}

        {applicationItems.length ? (
          <div className="spool-plate-soft p-4">
            <p className="text-xs font-semibold uppercase text-muted">Recent applications</p>
            <ul className="mt-2 space-y-2 text-sm text-muted">
              {applicationItems.map((application) => (
                <li key={application.id}>{application.label}</li>
              ))}
            </ul>
          </div>
        ) : null}
      </aside>
    </div>
  );
}
