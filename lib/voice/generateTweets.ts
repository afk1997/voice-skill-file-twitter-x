import { generateJsonWithLlm, hasUsableProvider } from "@/lib/llm/client";
import { mockGeneratedTweets } from "@/lib/llm/mockProvider";
import { candidatePoolSize } from "@/lib/llm/providerMode";
import { generateTweetPrompt } from "@/lib/llm/prompts/generateTweetPrompt";
import type { GeneratedTweetResult, LlmProviderConfig, VoiceSkillFile } from "@/lib/types";
import { evaluateTweet } from "@/lib/voice/evaluateTweet";

type LlmTweet = {
  text: string;
  reason?: string;
  issues?: string[];
  suggestedRevisionDirection?: string;
};

export async function generateTweets({
  context,
  tweetType,
  variations,
  notes,
  skillFile,
  examples,
  counterExamples = [],
  providerConfig,
}: {
  context: string;
  tweetType: string;
  variations: number;
  notes?: string;
  skillFile: VoiceSkillFile;
  examples: string[];
  counterExamples?: string[];
  providerConfig: LlmProviderConfig;
}): Promise<GeneratedTweetResult[]> {
  const count = Math.max(1, Math.min(10, variations));
  const internalCount = candidatePoolSize(count);

  if (!hasUsableProvider(providerConfig)) {
    return rankTweets(mockGeneratedTweets({ context, tweetType, variations: internalCount, skillFile }), count);
  }

  const response = await generateJsonWithLlm<{ tweets: LlmTweet[] }>({
    providerConfig,
    prompt: generateTweetPrompt({ context, tweetType, variations: internalCount, notes, skillFile, examples, counterExamples }),
  });

  return rankTweets(response.tweets.map((tweet) => {
    const evaluation = evaluateTweet({ tweet: tweet.text, context, tweetType, skillFile });
    return {
      text: tweet.text,
      score: evaluation.score,
      scoreLabel: evaluation.scoreLabel,
      reason: tweet.reason || evaluation.reason,
      issues: Array.from(new Set([...(tweet.issues || []), ...evaluation.issues])),
      suggestedRevisionDirection: tweet.suggestedRevisionDirection || evaluation.suggestedRevisionDirection,
      componentScores: evaluation.componentScores,
      shouldShow: evaluation.shouldShow,
    };
  }), count);
}

function rankTweets(tweets: GeneratedTweetResult[], count: number) {
  const uniqueTweets = new Map<string, GeneratedTweetResult>();
  for (const tweet of tweets) {
    const key = tweet.text.trim().toLowerCase();
    if (!key || uniqueTweets.has(key)) continue;
    uniqueTweets.set(key, tweet);
  }

  const ranked = Array.from(uniqueTweets.values()).sort((a, b) => b.score - a.score);
  const showable = ranked.filter((tweet) => tweet.shouldShow !== false);
  return (showable.length >= count ? showable : ranked).slice(0, count);
}
