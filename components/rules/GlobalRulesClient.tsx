"use client";

import React, { useState } from "react";
import { RuleForm } from "@/components/rules/RuleForm";
import { RuleList } from "@/components/rules/RuleList";
import type { RuleBankRuleInput } from "@/lib/rules/types";

export function GlobalRulesClient({ initialRules }: { initialRules: RuleBankRuleInput[] }) {
  const [rules, setRules] = useState(initialRules);

  return (
    <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
      <RuleForm onCreated={(rule) => setRules((current) => [rule, ...current])} />
      <section className="space-y-4">
        <div className="spool-plate-soft p-4">
          <p className="text-xs font-semibold uppercase text-muted">Global rules</p>
          <p className="mt-1 text-sm leading-6 text-muted">Starter and custom global rules are managed here. Apply them from a brand Rules Bank page.</p>
        </div>
        <RuleList rules={rules} selectedRuleIds={[]} onSelectionChange={() => undefined} />
      </section>
    </div>
  );
}
