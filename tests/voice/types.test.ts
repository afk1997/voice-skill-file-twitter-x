import { describe, expect, it } from "vitest";
import { BANNED_AI_PHRASES, FEEDBACK_LABELS, TWEET_TYPES } from "@/lib/constants";

describe("shared constants", () => {
  it("includes the required banned phrases and feedback labels", () => {
    expect(BANNED_AI_PHRASES).toContain("game-changing");
    expect(BANNED_AI_PHRASES).toContain("we are excited to announce");
    expect(FEEDBACK_LABELS).toContain("Too generic");
    expect(TWEET_TYPES).toContain("contrarian take");
  });
});
