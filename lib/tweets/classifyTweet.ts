import { BANNED_AI_PHRASES } from "@/lib/constants";
import type { ClassifiedTweet, ParsedTweet, TweetClassification } from "@/lib/types";
import { cleanTweet } from "@/lib/tweets/cleanTweet";

const GIVEAWAY_PATTERNS = [/giveaway/i, /follow.+retweet/i, /rt.+win/i, /winner announced/i];
const AUTOMATION_PATTERNS = [/posted automatically/i, /via buffer/i, /via zapier/i, /new blog post:/i];

function duplicateKey(text: string) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function isOnlyMentions(text: string) {
  return /^(@\w+\s*)+$/.test(text.trim());
}

function isOnlyHashtags(text: string) {
  return /^(#\w+\s*)+$/.test(text.trim());
}

function isPureUrl(text: string) {
  return /^(https?:\/\/\S+|\bt\.co\/\S+)\s*$/i.test(text.trim());
}

function classifySingle(tweet: ParsedTweet, cleanedText: string, seen: Set<string>): TweetClassification {
  const raw = tweet.rawText.trim();
  const key = duplicateKey(cleanedText);
  const isReplyMetadata = Boolean((tweet.metadata as { isReply?: unknown } | undefined)?.isReply);

  if (/^RT\s+@/i.test(raw)) return "retweet";
  if (isPureUrl(raw) || (cleanedText.length === 0 && /https?:\/\//i.test(raw))) return "link_only";
  if (cleanedText.length < 20) return "too_short";
  if (isOnlyMentions(raw) || isOnlyHashtags(raw)) return "noisy";
  if (GIVEAWAY_PATTERNS.some((pattern) => pattern.test(raw))) return "noisy";
  if (AUTOMATION_PATTERNS.some((pattern) => pattern.test(raw))) return "noisy";
  if (BANNED_AI_PHRASES.some((phrase) => cleanedText.toLowerCase().includes(phrase))) return "noisy";
  if (key && seen.has(key)) return "noisy";
  if (tweet.replyToTweetId || isReplyMetadata || /^@\w+/.test(raw)) return "reply";
  if (/\bquote tweet\b/i.test(raw) || /\bQT\s*@/i.test(raw)) return "quote";
  if (/^\d+\/\d+/.test(raw) || /\bthread\b/i.test(raw)) return "thread_candidate";
  return "useful";
}

function scoreTweet(classification: TweetClassification, cleanedText: string, tweet: ParsedTweet) {
  if (classification !== "useful") {
    return classification === "reply" || classification === "quote" || classification === "thread_candidate" ? 65 : 20;
  }

  let score = 70;
  if (cleanedText.length > 80) score += 8;
  if (cleanedText.length > 160) score += 5;
  if (/[.!?]$/.test(cleanedText)) score += 4;
  if ((tweet.favoriteCount ?? 0) > 10) score += 5;
  if ((tweet.retweetCount ?? 0) > 3) score += 5;
  if (cleanedText.includes("\n")) score += 3;
  return Math.min(100, score);
}

export function classifyTweets(tweets: ParsedTweet[]): ClassifiedTweet[] {
  const seen = new Set<string>();

  return tweets.map((tweet) => {
    const cleaned = cleanTweet(tweet.rawText);
    const key = duplicateKey(cleaned.cleanedText);
    const classification = classifySingle(tweet, cleaned.cleanedText, seen);
    const usedForVoice = classification === "useful" || classification === "reply" || classification === "quote" || classification === "thread_candidate";

    if (usedForVoice && key) {
      seen.add(key);
    }

    return {
      ...tweet,
      ...cleaned,
      classification,
      qualityScore: scoreTweet(classification, cleaned.cleanedText, tweet),
      usedForVoice,
      duplicateKey: key,
    };
  });
}
