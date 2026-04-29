"use client";

import React, { useState } from "react";
import { RULE_CATEGORIES, RULE_MODES, type RuleBankRuleInput, type RuleCategoryValue, type RuleModeValue } from "@/lib/rules/types";

export function RuleList({
  rules,
  selectedRuleIds,
  onSelectionChange,
  onEdit,
  selectable = true,
}: {
  rules: RuleBankRuleInput[];
  selectedRuleIds: string[];
  onSelectionChange: (ruleId: string, selected: boolean) => void;
  onEdit?: (rule: RuleBankRuleInput) => void;
  selectable?: boolean;
}) {
  const [category, setCategory] = useState<RuleCategoryValue | "all">("all");
  const [mode, setMode] = useState<RuleModeValue | "all">("all");
  const [selectedOnly, setSelectedOnly] = useState(false);
  const selected = new Set(selectedRuleIds);
  const visibleRules = rules.filter((rule) => {
    if (category !== "all" && rule.category !== category) return false;
    if (mode !== "all" && rule.mode !== mode) return false;
    if (selectedOnly && !selected.has(rule.id)) return false;
    return true;
  });

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-3">
        <label className="block space-y-1">
          <span className="text-sm font-medium text-ink">Category</span>
          <select aria-label="Category" value={category} onChange={(event) => setCategory(event.target.value as RuleCategoryValue | "all")} className="spool-field">
            <option value="all">All categories</option>
            {RULE_CATEGORIES.map((item) => (
              <option key={item} value={item}>
                {item.replaceAll("_", " ")}
              </option>
            ))}
          </select>
        </label>
        <label className="block space-y-1">
          <span className="text-sm font-medium text-ink">Mode</span>
          <select aria-label="Mode" value={mode} onChange={(event) => setMode(event.target.value as RuleModeValue | "all")} className="spool-field">
            <option value="all">All modes</option>
            {RULE_MODES.map((item) => (
              <option key={item} value={item}>
                {item.replaceAll("_", " ")}
              </option>
            ))}
          </select>
        </label>
        {selectable ? (
          <label className="flex items-end gap-2 pb-2 text-sm text-ink">
            <input type="checkbox" checked={selectedOnly} onChange={(event) => setSelectedOnly(event.target.checked)} />
            Selected only
          </label>
        ) : null}
      </div>
      <div className="space-y-3">
        {visibleRules.map((rule) => {
          const checked = selected.has(rule.id);
          return (
            <article key={rule.id} className="spool-plate-soft p-4">
              <div className="flex items-start gap-3">
                {selectable ? (
                  <input
                    aria-label={`Select ${rule.title}`}
                    type="checkbox"
                    checked={checked}
                    onChange={(event) => onSelectionChange(rule.id, event.target.checked)}
                    className="mt-1"
                  />
                ) : null}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-semibold text-ink">{rule.title}</h3>
                    <span className="spool-stamp">{rule.mode.replaceAll("_", " ")}</span>
                    <span className="border border-line bg-light px-2 py-1 text-xs text-muted">{rule.category.replaceAll("_", " ")}</span>
                    <span className="border border-line bg-light px-2 py-1 text-xs text-muted">{rule.source}</span>
                    {rule.source === "custom" && onEdit ? (
                      <button type="button" onClick={() => onEdit(rule)} className="text-xs font-semibold text-muted underline-offset-4 hover:text-ink hover:underline">
                        Edit
                      </button>
                    ) : null}
                  </div>
                  <p className="mt-2 text-sm leading-6 text-muted">{rule.body}</p>
                </div>
              </div>
            </article>
          );
        })}
        {visibleRules.length === 0 ? <p className="spool-plate-soft p-4 text-sm text-muted">No rules match these filters.</p> : null}
      </div>
    </div>
  );
}
