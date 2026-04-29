// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RuleForm } from "@/components/rules/RuleForm";
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

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

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

  it("can render as a browse-only list without selection controls", () => {
    render(<RuleList rules={rules} selectedRuleIds={[]} onSelectionChange={() => undefined} selectable={false} />);

    expect(screen.getByText("Concrete anchor")).toBeTruthy();
    expect(screen.queryByLabelText("Select Concrete anchor")).toBeNull();
    expect(screen.queryByText("Selected only")).toBeNull();
  });

  it("offers edit actions for custom rules", () => {
    const onEdit = vi.fn();
    render(<RuleList rules={rules} selectedRuleIds={[]} onSelectionChange={() => undefined} onEdit={onEdit} />);

    fireEvent.click(screen.getByRole("button", { name: "Edit" }));

    expect(onEdit).toHaveBeenCalledWith(rules[1]);
  });
});

describe("RuleForm", () => {
  it("saves edits with multiple targets", async () => {
    const updatedRule = {
      ...rules[1],
      body: "Avoid formula phrases and copy-paste artifacts.",
      targetJson: ["skill_rules", "avoided_phrases"],
    } satisfies RuleBankRuleInput;
    const fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ rule: updatedRule }),
    });
    const onSaved = vi.fn();
    vi.stubGlobal("fetch", fetch);

    render(<RuleForm onSaved={onSaved} editingRule={rules[1]} />);

    fireEvent.change(screen.getByLabelText("Rule text"), { target: { value: updatedRule.body } });
    fireEvent.click(screen.getByLabelText("skill rules"));
    fireEvent.click(screen.getByRole("button", { name: "Save rule" }));

    await waitFor(() => expect(fetch).toHaveBeenCalledOnce());
    expect(fetch).toHaveBeenCalledWith(
      "/api/rules/r2",
      expect.objectContaining({
        method: "PATCH",
      }),
    );
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual(
      expect.objectContaining({
        body: updatedRule.body,
        targetJson: ["avoided_phrases", "skill_rules"],
        payloadJson: { phrases: ["ever-evolving landscape"] },
      }),
    );
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith(updatedRule));
  });
});
