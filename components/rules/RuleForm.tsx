"use client";

import React, { useState, type FormEvent } from "react";
import { RULE_CATEGORIES, RULE_MODES, RULE_TARGETS, type RuleBankRuleInput, type RuleCategoryValue, type RuleModeValue, type RuleTargetValue } from "@/lib/rules/types";

export function RuleForm({ onCreated, brandId }: { onCreated: (rule: RuleBankRuleInput) => void; brandId?: string }) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [category, setCategory] = useState<RuleCategoryValue>("specificity");
  const [mode, setMode] = useState<RuleModeValue>("guidance");
  const [target, setTarget] = useState<RuleTargetValue>("skill_rules");
  const [phrases, setPhrases] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);
    const payloadJson = mode === "banned_phrase" ? { phrases: phrases.split(/\n|,/g).map((item) => item.trim()).filter(Boolean) } : {};
    const response = await fetch(brandId ? `/api/brands/${brandId}/rules` : "/api/rules", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title, body, category, mode, targetJson: [target], payloadJson }),
    });
    const json = await response.json();
    setLoading(false);
    if (!response.ok) {
      setError(json.error || "Could not create rule.");
      return;
    }
    setTitle("");
    setBody("");
    setPhrases("");
    onCreated(json.rule);
  }

  return (
    <form onSubmit={submit} className="space-y-3 spool-plate-soft p-4">
      <h2 className="font-semibold text-ink">Create custom rule</h2>
      <label className="block space-y-1">
        <span className="text-sm font-medium text-ink">Title</span>
        <input value={title} onChange={(event) => setTitle(event.target.value)} className="spool-field" required />
      </label>
      <label className="block space-y-1">
        <span className="text-sm font-medium text-ink">Rule text</span>
        <textarea value={body} onChange={(event) => setBody(event.target.value)} className="min-h-24 spool-field" required />
      </label>
      <div className="grid gap-3 sm:grid-cols-3">
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
          <select value={mode} onChange={(event) => setMode(event.target.value as RuleModeValue)} className="spool-field">
            {RULE_MODES.map((item) => (
              <option key={item} value={item}>
                {item.replaceAll("_", " ")}
              </option>
            ))}
          </select>
        </label>
        <label className="block space-y-1">
          <span className="text-sm font-medium text-ink">Target</span>
          <select value={target} onChange={(event) => setTarget(event.target.value as RuleTargetValue)} className="spool-field">
            {RULE_TARGETS.map((item) => (
              <option key={item} value={item}>
                {item.replaceAll("_", " ")}
              </option>
            ))}
          </select>
        </label>
      </div>
      {mode === "banned_phrase" ? (
        <label className="block space-y-1">
          <span className="text-sm font-medium text-ink">Banned phrases</span>
          <textarea value={phrases} onChange={(event) => setPhrases(event.target.value)} className="min-h-20 spool-field" />
        </label>
      ) : null}
      {error ? <p className="text-sm text-weak">{error}</p> : null}
      <button type="submit" disabled={loading} className="spool-button disabled:opacity-60">
        {loading ? "Creating..." : "Create rule"}
      </button>
    </form>
  );
}
