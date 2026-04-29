"use client";

import React, { useState } from "react";
import { RuleForm } from "@/components/rules/RuleForm";
import { RuleList } from "@/components/rules/RuleList";
import type { RuleBankRuleInput } from "@/lib/rules/types";

export function GlobalRulesClient({ initialRules }: { initialRules: RuleBankRuleInput[] }) {
  const [rules, setRules] = useState(initialRules);
  const [editingRule, setEditingRule] = useState<RuleBankRuleInput | null>(null);

  function saveRule(rule: RuleBankRuleInput) {
    setRules((current) => (current.some((item) => item.id === rule.id) ? current.map((item) => (item.id === rule.id ? rule : item)) : [rule, ...current]));
    setEditingRule(null);
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
      <RuleForm onSaved={saveRule} editingRule={editingRule} onCancelEdit={() => setEditingRule(null)} />
      <section className="space-y-4">
        <div className="spool-plate-soft p-4">
          <p className="text-xs font-semibold uppercase text-muted">Global rules</p>
          <p className="mt-1 text-sm leading-6 text-muted">Starter and custom global rules are managed here. Apply them from a brand Rules Bank page.</p>
        </div>
        <RuleList rules={rules} selectedRuleIds={[]} onSelectionChange={() => undefined} onEdit={setEditingRule} selectable={false} />
      </section>
    </div>
  );
}
