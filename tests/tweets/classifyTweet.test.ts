import { describe, expect, it } from "vitest";
import { classifyTweets } from "@/lib/tweets/classifyTweet";
import type { ParsedTweet } from "@/lib/types";

function parsed(rawText: string): ParsedTweet {
  return {
    rawText,
    hashtags: [],
    mentions: [],
    urls: [],
    metadata: {},
  };
}

describe("classifyTweets", () => {
  it("excludes retweets", () => {
    const [tweet] = classifyTweets([parsed("RT @founder: this is a repost")]);
    expect(tweet.classification).toBe("retweet");
    expect(tweet.usedForVoice).toBe(false);
  });

  it("excludes link-only tweets", () => {
    const [tweet] = classifyTweets([parsed("https://example.com")]);
    expect(tweet.classification).toBe("link_only");
    expect(tweet.usedForVoice).toBe(false);
  });

  it("excludes too-short tweets", () => {
    const [tweet] = classifyTweets([parsed("tiny")]);
    expect(tweet.classification).toBe("too_short");
    expect(tweet.usedForVoice).toBe(false);
  });

  it("marks useful original tweets", () => {
    const [tweet] = classifyTweets([parsed("Specific examples beat vague advice because they give the reader something to copy.")]);
    expect(tweet.classification).toBe("useful");
    expect(tweet.usedForVoice).toBe(true);
    expect(tweet.qualityScore).toBeGreaterThanOrEqual(70);
  });

  it("marks duplicate tweets as noisy after the first instance", () => {
    const [first, second] = classifyTweets([
      parsed("Specific examples beat vague advice because they give the reader something to copy."),
      parsed("Specific examples beat vague advice because they give the reader something to copy."),
    ]);
    expect(first.usedForVoice).toBe(true);
    expect(second.classification).toBe("noisy");
    expect(second.usedForVoice).toBe(false);
  });
});
