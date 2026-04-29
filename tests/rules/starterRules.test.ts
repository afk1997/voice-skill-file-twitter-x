import { describe, expect, it } from "vitest";
import { RULE_CATEGORIES, RULE_MODES, RULE_TARGETS } from "@/lib/rules/types";
import { STARTER_RULES } from "@/lib/rules/starterRules";

describe("STARTER_RULES", () => {
  it("uses stable unique ids and known taxonomy values", () => {
    const ids = STARTER_RULES.map((rule) => rule.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(STARTER_RULES.length).toBeGreaterThanOrEqual(12);

    for (const rule of STARTER_RULES) {
      expect(rule.source).toBe("starter");
      expect(rule.scope).toBe("global");
      expect(RULE_CATEGORIES).toContain(rule.category);
      expect(RULE_MODES).toContain(rule.mode);
      expect(rule.title.trim().length).toBeGreaterThan(4);
      expect(rule.body.trim().length).toBeGreaterThan(12);
      expect(rule.targetJson.length).toBeGreaterThan(0);
      for (const target of rule.targetJson) {
        expect(RULE_TARGETS).toContain(target);
      }
    }
  });

  it("includes concrete starter rules from the writing ruleset", () => {
    expect(STARTER_RULES.some((rule) => rule.id === "starter-fact-no-invented-claims")).toBe(true);
    expect(STARTER_RULES.some((rule) => rule.id === "starter-specificity-concrete-anchor")).toBe(true);
    expect(STARTER_RULES.some((rule) => rule.id === "starter-formula-phrases")).toBe(true);
    expect(STARTER_RULES.some((rule) => rule.id === "starter-regularity-em-dash-casual")).toBe(true);
  });

  it("stores phrases for banned phrase rules", () => {
    const formula = STARTER_RULES.find((rule) => rule.id === "starter-formula-phrases");
    expect(formula?.mode).toBe("banned_phrase");
    expect(formula?.payloadJson.phrases).toContain("ever-evolving landscape");
    expect(formula?.payloadJson.phrases).toContain("it's important to note");
  });
});
