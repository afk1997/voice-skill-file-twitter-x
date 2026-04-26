import { describe, expect, it } from "vitest";
import { FEEDBACK_LABELS } from "@/lib/constants";
import { FEEDBACK_ACTIONS, NOTE_ONLY_FEEDBACK_LABEL, PRIMARY_FEEDBACK_ACTIONS, REJECT_FEEDBACK_LABEL } from "@/lib/voice/feedbackActions";

describe("feedbackActions", () => {
  it("separates primary draft decisions from revision requests", () => {
    expect(PRIMARY_FEEDBACK_ACTIONS.map((action) => action.title)).toEqual(["Approve draft", "Reject draft"]);
  });

  it("keeps correction reasons available without making each one a visible primary button", () => {
    expect(FEEDBACK_ACTIONS).toHaveLength(10);
    expect(FEEDBACK_ACTIONS.map((action) => action.label)).toContain("Too generic");
    expect(FEEDBACK_ACTIONS.map((action) => action.label)).toContain("Good tone, weak hook");
  });

  it("supports saving a typed note without choosing another feedback action", () => {
    expect(NOTE_ONLY_FEEDBACK_LABEL).toBe("Save note only");
    expect(FEEDBACK_LABELS).toContain(NOTE_ONLY_FEEDBACK_LABEL);
  });

  it("supports rejecting a draft explicitly", () => {
    expect(REJECT_FEEDBACK_LABEL).toBe("Reject draft");
    expect(FEEDBACK_LABELS).toContain(REJECT_FEEDBACK_LABEL);
  });
});
