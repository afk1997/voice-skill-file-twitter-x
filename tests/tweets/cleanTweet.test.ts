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

  it("removes quoted tweet context from authored voice text", () => {
    expect(cleanTweet("We cooking 👀 [Quote tweet from Venky @0xVenky · Aug 19, 2025]: 👀 soon").cleanedText).toBe("We cooking 👀");
    expect(cleanTweet("[Quote tweet from BaseSwap @BaseSwapDex · Feb 18, 2025]: Introducing Range-Based Incentives").cleanedText).toBe("");
  });

  it("removes media and link-card annotations from authored voice text", () => {
    expect(cleanTweet("Quick Comparison 👀 [Image showing METROM comparison table]").cleanedText).toBe("Quick Comparison 👀");
    expect(cleanTweet("Read the full announcement [Link card: medium.com - METROM POWERS]").cleanedText).toBe("Read the full announcement");
    expect(cleanTweet("[Video thumbnail 0:35 showing campaign setup]").cleanedText).toBe("");
  });
});
