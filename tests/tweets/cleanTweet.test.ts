import { describe, expect, it } from "vitest";
import { cleanTweet } from "@/lib/tweets/cleanTweet";

describe("cleanTweet", () => {
  it("removes t.co URLs while preserving words", () => {
    expect(cleanTweet("Read this now https://t.co/abc123").cleanedText).toBe("Read this now");
  });

  it("normalizes whitespace and HTML entities", () => {
    expect(cleanTweet("Build&nbsp;in public &amp; learn\n\nfast").cleanedText).toBe("Build in public & learn fast");
  });
});
