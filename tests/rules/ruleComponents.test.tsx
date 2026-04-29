// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RuleList } from "@/components/rules/RuleList";
import type { RuleBankRuleInput } from "@/lib/rules/types";

const rules: RuleBankRuleInput[] = [
  {
    id: "r1",
    title: "Concrete anchor",
    body: "Add a concrete anchor.",
    category: "specificity",
    mode: "guidance",
    source: "starter",
    scope: "global",
    targetJson: ["skill_rules"],
    payloadJson: {},
    enabled: true,
  },
  {
    id: "r2",
    title: "Ban phrases",
    body: "Avoid formula phrases.",
    category: "formula_phrases",
    mode: "banned_phrase",
    source: "custom",
    scope: "global",
    targetJson: ["avoided_phrases"],
    payloadJson: { phrases: ["ever-evolving landscape"] },
    enabled: true,
  },
];

afterEach(() => cleanup());

describe("RuleList", () => {
  it("renders rules and toggles a selected rule", () => {
    const onSelectionChange = vi.fn();
    render(<RuleList rules={rules} selectedRuleIds={["r1"]} onSelectionChange={onSelectionChange} />);

    expect(screen.getByText("Concrete anchor")).toBeTruthy();
    expect(screen.getByText("Ban phrases")).toBeTruthy();
    fireEvent.click(screen.getByLabelText("Select Ban phrases"));
    expect(onSelectionChange).toHaveBeenCalledWith("r2", true);
  });

  it("filters by mode", () => {
    render(<RuleList rules={rules} selectedRuleIds={[]} onSelectionChange={() => undefined} />);
    fireEvent.change(screen.getByLabelText("Mode"), { target: { value: "banned_phrase" } });

    expect(screen.queryByText("Concrete anchor")).toBeNull();
    expect(screen.getByText("Ban phrases")).toBeTruthy();
  });
});
