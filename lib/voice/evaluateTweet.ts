import { BANNED_AI_PHRASES } from "@/lib/constants";
import type { VoiceSkillFile } from "@/lib/types";

export function scoreLabel(score: number) {
  if (score >= 90) return "Very strong match";
  if (score >= 80) return "Strong match";
  if (score >= 70) return "Good match";
  return "Weak match";
}

function hasConcreteSignal(tweet: string) {
  return /\b\d+\b/.test(tweet) || /\b(customer|user|founder|team|repo|launch|archive|tweet|workflow|example|file)\b/i.test(tweet);
}

export function evaluateTweet({
  tweet,
  context,
  tweetType,
  skillFile,
}: {
  tweet: string;
  context: string;
  tweetType: string;
  skillFile: VoiceSkillFile;
}) {
  const lower = tweet.toLowerCase();
  const avoided = [...(skillFile.avoidedPhrases ?? []), ...BANNED_AI_PHRASES];
  const issues: string[] = [];
  let score = 78;

  for (const phrase of avoided) {
    if (phrase && lower.includes(phrase.toLowerCase())) {
      score -= 12;
      issues.push(`Uses avoided phrase: ${phrase}`);
    }
  }

  if (tweet.length > 280 && tweetType !== "thread") {
    score -= 18;
    issues.push("Too long for a single tweet");
  }

  if (tweet.length < 35) {
    score -= 8;
    issues.push("Too short to carry a clear voice signal");
  }

  if (hasConcreteSignal(tweet)) {
    score += 8;
  } else {
    score -= 10;
    issues.push("Needs a more concrete noun, example, or claim");
  }

  if (/^i\b|^we\b|^you\b|^[A-Z][^.!?]+[.!?]/i.test(tweet.trim())) {
    score += 5;
  } else {
    score -= 4;
    issues.push("Hook could be sharper");
  }

  const firstContextWord = context.split(/\s+/)[0]?.toLowerCase();
  if (firstContextWord && tweet.toLowerCase().includes(firstContextWord)) {
    score += 4;
  }

  const bounded = Math.max(0, Math.min(100, score));

  return {
    score: bounded,
    scoreLabel: scoreLabel(bounded),
    reason: issues.length === 0 ? "Matches the skill file rules and stays specific." : "Needs revision against the skill file rules.",
    issues: Array.from(new Set(issues)),
    suggestedRevisionDirection:
      issues.length === 0 ? "Keep the structure and preserve the concrete phrasing." : "Make it more specific, less polished, and closer to the approved examples.",
  };
}
