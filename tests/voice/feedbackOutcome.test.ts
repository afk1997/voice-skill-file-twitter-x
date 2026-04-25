import { describe, expect, it } from "vitest";
import { feedbackOutcome } from "@/lib/voice/feedbackOutcome";

describe("feedbackOutcome", () => {
  it("explains approved feedback and primary next action", () => {
    expect(feedbackOutcome("Sounds like us")).toEqual({
      title: "Approved example saved",
      description: "This draft was added to approved generated examples in the Voice Skill File.",
      primaryAction: "Generate another batch",
    });
  });

  it("explains corrective feedback", () => {
    expect(feedbackOutcome("Too generic")).toMatchObject({
      title: "Specificity rule added",
      description: "The Voice Skill File now prefers concrete examples, concrete nouns, and sharper claims.",
    });
  });

  it("uses a sensible fallback for supported labels without custom copy", () => {
    expect(feedbackOutcome("Good tone, weak hook").primaryAction).toBe("Generate another batch");
  });
});
