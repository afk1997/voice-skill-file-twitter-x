"use client";

import React, { useEffect, useState, type FormEvent } from "react";
import { RULE_CATEGORIES, RULE_MODES, RULE_TARGETS, type RuleBankRuleInput, type RuleCategoryValue, type RuleModeValue, type RuleTargetValue } from "@/lib/rules/types";

function defaultTargetsForMode(mode: RuleModeValue): RuleTargetValue[] {
  if (mode === "banned_phrase") return ["skill_rules", "avoided_phrases", "retrieval_avoid_vocabulary"];
  if (mode === "hard_constraint") return ["skill_rules", "linguistic_rules"];
  if (mode === "retrieval_hint") return ["retrieval_preferred_vocabulary"];
  return ["skill_rules"];
}

function phrasesFromRule(rule?: RuleBankRuleInput | null) {
  return rule?.payloadJson.phrases?.join("\n") ?? "";
}

export function RuleForm({
  onSaved,
  brandId,
  editingRule,
  onCancelEdit,
}: {
  onSaved: (rule: RuleBankRuleInput) => void;
  brandId?: string;
  editingRule?: RuleBankRuleInput | null;
  onCancelEdit?: () => void;
}) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [category, setCategory] = useState<RuleCategoryValue>("specificity");
  const [mode, setMode] = useState<RuleModeValue>("guidance");
  const [targets, setTargets] = useState<RuleTargetValue[]>(defaultTargetsForMode("guidance"));
  const [phrases, setPhrases] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const isEditing = Boolean(editingRule);
  const hasTargets = targets.length > 0;

  useEffect(() => {
    if (!editingRule) {
      setTitle("");
      setBody("");
      setCategory("specificity");
      setMode("guidance");
      setTargets(defaultTargetsForMode("guidance"));
      setPhrases("");
      setError("");
      return;
    }

    setTitle(editingRule.title);
    setBody(editingRule.body);
    setCategory(editingRule.category);
    setMode(editingRule.mode);
    setTargets(editingRule.targetJson.length ? editingRule.targetJson : defaultTargetsForMode(editingRule.mode));
    setPhrases(phrasesFromRule(editingRule));
    setError("");
  }, [editingRule]);

  function updateMode(nextMode: RuleModeValue) {
    setMode(nextMode);
    setTargets(defaultTargetsForMode(nextMode));
  }

  function toggleTarget(target: RuleTargetValue, selected: boolean) {
    setTargets((current) => {
      if (selected) return Array.from(new Set([...current, target]));
      return current.filter((item) => item !== target);
    });
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);
    const payloadJson = mode === "banned_phrase" ? { phrases: phrases.split(/\n|,/g).map((item) => item.trim()).filter(Boolean) } : {};
    const path = brandId ? `/api/brands/${brandId}/rules${editingRule ? `/${editingRule.id}` : ""}` : `/api/rules${editingRule ? `/${editingRule.id}` : ""}`;
    const response = await fetch(path, {
      method: editingRule ? "PATCH" : "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title, body, category, mode, targetJson: targets, payloadJson }),
    });
    const json = await response.json();
    setLoading(false);
    if (!response.ok) {
      setError(json.error || `Could not ${editingRule ? "update" : "create"} rule.`);
      return;
    }
    if (!editingRule) {
      setTitle("");
      setBody("");
      setPhrases("");
      setTargets(defaultTargetsForMode("guidance"));
    }
    onSaved(json.rule);
  }

  return (
    <form onSubmit={submit} className="space-y-3 spool-plate-soft p-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-semibold text-ink">{isEditing ? "Edit custom rule" : "Create custom rule"}</h2>
        {isEditing && onCancelEdit ? (
          <button type="button" onClick={onCancelEdit} className="text-sm font-medium text-muted hover:text-ink">
            Cancel
          </button>
        ) : null}
      </div>
      <label className="block space-y-1">
        <span className="text-sm font-medium text-ink">Title</span>
        <input value={title} onChange={(event) => setTitle(event.target.value)} className="spool-field" required />
      </label>
      <label className="block space-y-1">
        <span className="text-sm font-medium text-ink">Rule text</span>
        <textarea value={body} onChange={(event) => setBody(event.target.value)} className="min-h-24 spool-field" required />
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block space-y-1">
          <span className="text-sm font-medium text-ink">Category</span>
          <select value={category} onChange={(event) => setCategory(event.target.value as RuleCategoryValue)} className="spool-field">
            {RULE_CATEGORIES.map((item) => (
              <option key={item} value={item}>
                {item.replaceAll("_", " ")}
              </option>
            ))}
          </select>
        </label>
        <label className="block space-y-1">
          <span className="text-sm font-medium text-ink">Mode</span>
          <select value={mode} onChange={(event) => updateMode(event.target.value as RuleModeValue)} className="spool-field">
            {RULE_MODES.map((item) => (
              <option key={item} value={item}>
                {item.replaceAll("_", " ")}
              </option>
            ))}
          </select>
        </label>
      </div>
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium text-ink">Targets</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {RULE_TARGETS.map((item) => (
            <label key={item} className="flex items-center gap-2 text-sm text-muted">
              <input type="checkbox" checked={targets.includes(item)} onChange={(event) => toggleTarget(item, event.target.checked)} />
              {item.replaceAll("_", " ")}
            </label>
          ))}
        </div>
      </fieldset>
      {mode === "banned_phrase" ? (
        <label className="block space-y-1">
          <span className="text-sm font-medium text-ink">Banned phrases</span>
          <textarea value={phrases} onChange={(event) => setPhrases(event.target.value)} className="min-h-20 spool-field" />
        </label>
      ) : null}
      {!hasTargets ? <p className="text-sm text-weak">Select at least one target.</p> : null}
      {error ? <p className="text-sm text-weak">{error}</p> : null}
      <button type="submit" disabled={loading || !hasTargets} className="spool-button disabled:opacity-60">
        {loading ? (isEditing ? "Saving..." : "Creating...") : isEditing ? "Save rule" : "Create rule"}
      </button>
    </form>
  );
}
