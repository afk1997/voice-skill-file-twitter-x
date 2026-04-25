import { describe, expect, it } from "vitest";
import { cleanTweet } from "@/lib/tweets/cleanTweet";

describe("cleanTweet", () => {
  it("removes t.co URLs while preserving words", () => {
    expect(cleanTweet("Read this now https://t.co/abc123").cleanedText).toBe("Read this now");
  });

  it("normalizes spacing and HTML entities without flattening tweet line breaks", () => {
    expect(cleanTweet("Build&nbsp;in public &amp; learn\n\nfast").cleanedText).toBe("Build in public & learn\n\nfast");
  });

  it("preserves intentional tweet formatting after removing URLs", () => {
    expect(cleanTweet("Hook\n\n* Point one\n* Point two https://t.co/abc123").cleanedText).toBe("Hook\n\n* Point one\n* Point two");
  });
});
