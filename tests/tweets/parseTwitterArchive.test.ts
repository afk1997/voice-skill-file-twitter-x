import { describe, expect, it } from "vitest";
import { parseTweetTextContent, stripTwitterAssignment } from "@/lib/tweets/parseTwitterArchive";

describe("stripTwitterAssignment", () => {
  it("strips window.YTD assignment prefixes", () => {
    const input = "window.YTD.tweets.part0 = [{\"tweet\":{\"full_text\":\"hello\"}}]";
    expect(stripTwitterAssignment(input)).toBe("[{\"tweet\":{\"full_text\":\"hello\"}}]");
  });

  it("strips simple variable assignment prefixes", () => {
    const input = "var data = [{\"text\":\"hello\"}];";
    expect(stripTwitterAssignment(input)).toBe("[{\"text\":\"hello\"}]");
  });
});

describe("parseTweetTextContent", () => {
  it("parses Twitter archive JS", async () => {
    const parsed = await parseTweetTextContent(
      "tweets.js",
      "window.YTD.tweets.part0 = [{\"tweet\":{\"full_text\":\"A real tweet sample with enough words\",\"created_at\":\"2024-01-01\",\"favorite_count\":\"4\",\"retweet_count\":\"2\",\"lang\":\"en\"}}]",
    );
    expect(parsed.totalFound).toBe(1);
    expect(parsed.tweets[0].rawText).toBe("A real tweet sample with enough words");
    expect(parsed.tweets[0].favoriteCount).toBe(4);
  });

  it("parses JSON arrays", async () => {
    const parsed = await parseTweetTextContent("tweets.json", "[{\"text\":\"JSON tweet sample with useful context\"}]");
    expect(parsed.tweets[0].rawText).toBe("JSON tweet sample with useful context");
  });

  it("parses CSV with text column", async () => {
    const parsed = await parseTweetTextContent("tweets.csv", "text,created_at\n\"CSV tweet sample with useful context\",2024-01-01");
    expect(parsed.tweets[0].rawText).toBe("CSV tweet sample with useful context");
  });

  it("parses TXT by blank lines", async () => {
    const parsed = await parseTweetTextContent(
      "tweets.txt",
      "First tweet sample with useful context\n\nSecond tweet sample with useful context",
    );
    expect(parsed.tweets).toHaveLength(2);
  });

  it("parses underscore-delimited timeline exports as whole tweets", async () => {
    const parsed = await parseTweetTextContent(
      "tweets.txt",
      `Jan 1, 2025
Sonic Boom!


We’re thrilled to announce that Metrom is launching on @SonicLabs!


Let’s break it down




________________


Jan 1, 2025 (reply)
We're thrilled to support Sonic's ecosystem and introduce efficient liquidity mining on a blockchain designed for the future.
Stay tuned for updates.
________________`,
    );

    expect(parsed.tweets).toHaveLength(2);
    expect(parsed.tweets[0].createdAt).toBe("Jan 1, 2025");
    expect(parsed.tweets[0].rawText).toContain("Sonic Boom!");
    expect(parsed.tweets[0].rawText).toContain("We’re thrilled to announce");
    expect(parsed.tweets[0].rawText).not.toContain("Jan 1, 2025");
    expect(parsed.tweets[0].rawText).not.toContain("________________");
    expect(parsed.tweets[1].createdAt).toBe("Jan 1, 2025");
    expect(parsed.tweets[1].metadata).toMatchObject({ isReply: true, replyContext: "reply" });
    expect(parsed.tweets[1].rawText).toBe(
      "We're thrilled to support Sonic's ecosystem and introduce efficient liquidity mining on a blockchain designed for the future.\nStay tuned for updates.",
    );
  });
});
