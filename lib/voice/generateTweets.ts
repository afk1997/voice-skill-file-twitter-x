import { generateJsonWithLlm, hasUsableProvider } from "@/lib/llm/client";
import { evaluateTweetsPrompt } from "@/lib/llm/prompts/evaluateTweetPrompt";
import { candidatePoolSize } from "@/lib/llm/providerMode";
import { generateTweetPrompt } from "@/lib/llm/prompts/generateTweetPrompt";
import type { EvaluationComponentScores, GeneratedTweetResult, LlmProviderConfig, VoiceSkillFile } from "@/lib/types";
import { evaluateTweet } from "@/lib/voice/evaluateTweet";

type LlmTweet = {
  text: string;
  reason?: string;
  issues?: string[];
  suggestedRevisionDirection?: string;
};

type LlmEvaluation = {
  index: number;
  score: number;
  componentScores?: EvaluationComponentScores;
  reason?: string;
  issues?: string[];
  suggestedRevisionDirection?: string;
  shouldShow?: boolean;
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
    throw new Error("A real LLM provider is required. Add a provider key in Settings or .env.local.");
  }

  const response = await generateJsonWithLlm<{ tweets: LlmTweet[] }>({
    providerConfig,
    prompt: generateTweetPrompt({ context, tweetType, variations: internalCount, notes, skillFile, examples, counterExamples }),
  });

  const generated = response.tweets.map((tweet) => {
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
  });

  const llmEvaluated = await evaluateGeneratedTweetsWithLlm({
    tweets: generated,
    context,
    tweetType,
    skillFile,
    providerConfig,
  });

  return rankTweets(llmEvaluated, count);
}

async function evaluateGeneratedTweetsWithLlm({
  tweets,
  context,
  tweetType,
  skillFile,
  providerConfig,
}: {
  tweets: GeneratedTweetResult[];
  context: string;
  tweetType: string;
  skillFile: VoiceSkillFile;
  providerConfig: LlmProviderConfig;
}) {
  const response = await generateJsonWithLlm<{ evaluations: LlmEvaluation[] }>({
    providerConfig,
    prompt: evaluateTweetsPrompt({ tweets: tweets.map((tweet) => tweet.text), context, tweetType, skillFile }),
  });
  const evaluationsByIndex = new Map(response.evaluations.map((evaluation) => [evaluation.index, evaluation]));

  return tweets.map((tweet, index) => {
    const heuristic = evaluateTweet({ tweet: tweet.text, context, tweetType, skillFile });
    const llm = evaluationsByIndex.get(index);
    if (!llm) return tweet;

    const issues = Array.from(new Set([...(llm.issues || []), ...heuristic.issues]));
    const hasHardIssue = heuristic.shouldShow === false;
    return {
      ...tweet,
      score: Math.max(0, Math.min(100, Math.round(llm.score))),
      scoreLabel: scoreLabelFromNumber(llm.score),
      reason: llm.reason || tweet.reason,
      issues,
      suggestedRevisionDirection: llm.suggestedRevisionDirection || tweet.suggestedRevisionDirection,
      componentScores: llm.componentScores || tweet.componentScores,
      shouldShow: hasHardIssue ? false : llm.shouldShow !== false,
    };
  });
}

function scoreLabelFromNumber(score: number) {
  if (score >= 90) return "Very strong match";
  if (score >= 80) return "Strong match";
  if (score >= 70) return "Good match";
  return "Weak match";
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
