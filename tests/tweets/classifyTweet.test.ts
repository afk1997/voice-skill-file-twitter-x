import { describe, expect, it } from "vitest";
import { classifyTweets } from "@/lib/tweets/classifyTweet";
import { parseTweetTextContent } from "@/lib/tweets/parseTwitterArchive";
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

  it("keeps substantive replies available for voice learning", () => {
    const [tweet] = classifyTweets([
      {
        ...parsed("We're thrilled to support Sonic's ecosystem and introduce efficient liquidity mining on a blockchain designed for the future."),
        metadata: { isReply: true, replyContext: "reply" },
      },
    ]);
    expect(tweet.classification).toBe("reply");
    expect(tweet.usedForVoice).toBe(true);
  });

  it("keeps inline reply metadata out of cleaned voice text", async () => {
    const parsedTweets = await parseTweetTextContent(
      "tweets.txt",
      "Sep 9, 2025 (reply to @metromxyz) KPI based incentives are beneficial for Protocols & LPs alike!",
    );
    const [tweet] = classifyTweets(parsedTweets.tweets);

    expect(tweet.classification).toBe("reply");
    expect(tweet.cleanedText).toBe("KPI based incentives are beneficial for Protocols & LPs alike!");
    expect(tweet.cleanedText).not.toContain("reply to @");
  });

  it("does not use quoted third-party context for voice learning", () => {
    const [quoteOnly, quoteWithComment, quoteWithLongComment] = classifyTweets([
      parsed("[Quote tweet from BaseSwap @BaseSwapDex · Feb 18, 2025]: Introducing Range-Based Incentives for V3 on BaseSwap!"),
      parsed("We cooking 👀 [Quote tweet from Venky @0xVenky · Aug 19, 2025]: 👀 soon"),
      parsed("This partner integration is exactly the kind of liquidity UX we want to see. [Quote tweet from Partner @partner · Feb 18, 2025]: third party text"),
    ]);

    expect(quoteOnly.classification).toBe("too_short");
    expect(quoteOnly.usedForVoice).toBe(false);
    expect(quoteOnly.cleanedText).toBe("");
    expect(quoteWithComment.classification).toBe("too_short");
    expect(quoteWithComment.usedForVoice).toBe(false);
    expect(quoteWithComment.cleanedText).toBe("We cooking 👀");
    expect(quoteWithLongComment.classification).toBe("quote");
    expect(quoteWithLongComment.usedForVoice).toBe(false);
    expect(quoteWithLongComment.cleanedText).toBe("This partner integration is exactly the kind of liquidity UX we want to see.");
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
