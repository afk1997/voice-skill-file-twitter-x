import { describe, expect, it } from "vitest";
import { FEEDBACK_LABELS } from "@/lib/constants";
import { FEEDBACK_ACTIONS, NOTE_ONLY_FEEDBACK_LABEL, PRIMARY_FEEDBACK_ACTIONS, REJECT_FEEDBACK_LABEL } from "@/lib/voice/feedbackActions";

describe("feedbackActions", () => {
  it("separates primary draft decisions from revision requests", () => {
    expect(PRIMARY_FEEDBACK_ACTIONS.map((action) => action.title)).toEqual(["Approve draft", "Reject draft"]);
  });

  it("uses action-oriented button copy for revision requests instead of raw diagnostic labels", () => {
    expect(FEEDBACK_ACTIONS.map((action) => action.title)).toEqual([
      "Make it more specific",
      "Make it less formal",
      "Make it more credible",
      "Reduce sales tone",
      "Make it less corporate",
      "Shorten it",
      "Remove hype",
      "Fix vocabulary",
      "Keep idea, change tone",
      "Keep tone, sharpen hook",
    ]);
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
