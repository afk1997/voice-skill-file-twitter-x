import { generateJsonWithLlm, hasUsableProvider } from "@/lib/llm/client";
import { mockGeneratedTweets } from "@/lib/llm/mockProvider";
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
  providerConfig,
}: {
  context: string;
  tweetType: string;
  variations: number;
  notes?: string;
  skillFile: VoiceSkillFile;
  examples: string[];
  providerConfig: LlmProviderConfig;
}): Promise<GeneratedTweetResult[]> {
  const count = Math.max(1, Math.min(10, variations));

  if (!hasUsableProvider(providerConfig)) {
    return mockGeneratedTweets({ context, tweetType, variations: count, skillFile });
  }

  const response = await generateJsonWithLlm<{ tweets: LlmTweet[] }>({
    providerConfig,
    prompt: generateTweetPrompt({ context, tweetType, variations: count, notes, skillFile, examples }),
  });

  return response.tweets.slice(0, count).map((tweet) => {
    const evaluation = evaluateTweet({ tweet: tweet.text, context, tweetType, skillFile });
    return {
      text: tweet.text,
      score: evaluation.score,
      scoreLabel: evaluation.scoreLabel,
      reason: tweet.reason || evaluation.reason,
      issues: Array.from(new Set([...(tweet.issues || []), ...evaluation.issues])),
      suggestedRevisionDirection: tweet.suggestedRevisionDirection || evaluation.suggestedRevisionDirection,
    };
  });
}
