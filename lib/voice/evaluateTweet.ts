import { BANNED_AI_PHRASES } from "@/lib/constants";
import type { EvaluationComponentScores, VoiceSkillFile } from "@/lib/types";

export function scoreLabel(score: number) {
  if (score >= 90) return "Very strong match";
  if (score >= 80) return "Strong match";
  if (score >= 70) return "Good match";
  return "Weak match";
}

function hasConcreteSignal(tweet: string) {
  return (
    /\b\d+\b/.test(tweet) ||
    /\b(customer|user|founder|team|repo|launch|archive|tweet|workflow|example|file|defi|reward|deposit|hold|earn|product|tradeoff|specific|campaign)\b/i.test(tweet)
  );
}

function clamp(value: number, max: number) {
  return Math.max(0, Math.min(max, Math.round(value)));
}

function contextOverlap(tweet: string, context: string) {
  const tweetTerms = new Set(tweet.toLowerCase().match(/[a-z][a-z0-9']+/g) ?? []);
  const contextTerms = new Set((context.toLowerCase().match(/[a-z][a-z0-9']+/g) ?? []).filter((term) => term.length > 2));
  let count = 0;
  for (const term of contextTerms) {
    if (tweetTerms.has(term)) count += 1;
  }
  return count;
}

function hasLearnedEmDashBan(skillFile: VoiceSkillFile) {
  return (
    skillFile.avoidedPhrases?.includes("—") ||
    skillFile.linguisticRules?.some((rule) => /do not use em dashes|avoid em dashes/i.test(rule)) ||
    skillFile.rules?.some((rule) => /do not use em dashes|avoid em dashes/i.test(rule.rule))
  );
}

function totalScore(componentScores: EvaluationComponentScores) {
  return Object.values(componentScores).reduce((total, score) => total + score, 0);
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
  const componentScores: EvaluationComponentScores = {
    brandVoiceMatch: 30,
    twitterNativeness: 17,
    specificity: hasConcreteSignal(tweet) ? 14 : 7,
    hookQuality: /^(\w+|["'])/.test(tweet.trim()) ? 8 : 5,
    nonGeneric: 9,
    ctaFit: 4,
    safetyFactuality: 5,
  };

  for (const phrase of avoided) {
    if (phrase && lower.includes(phrase.toLowerCase())) {
      componentScores.brandVoiceMatch -= 8;
      componentScores.nonGeneric -= 5;
      issues.push(`Uses avoided phrase: ${phrase}`);
    }
  }

  if (/we are excited to announce|powerful solution|transform the way|in today's fast-paced world/i.test(tweet)) {
    componentScores.brandVoiceMatch -= 8;
    componentScores.nonGeneric -= 4;
    issues.push("Sounds like polished generic AI or corporate launch copy");
  }

  if (hasLearnedEmDashBan(skillFile) && tweet.includes("—")) {
    componentScores.brandVoiceMatch -= 10;
    componentScores.twitterNativeness -= 4;
    componentScores.nonGeneric -= 3;
    issues.push("Violates learned punctuation rule: do not use em dashes");
  }

  if (tweet.length > 280 && tweetType !== "thread") {
    componentScores.twitterNativeness -= 10;
    issues.push("Too long for a single tweet");
  }

  if (tweet.length < 35) {
    componentScores.twitterNativeness -= 5;
    componentScores.specificity -= 3;
    issues.push("Too short to carry a clear voice signal");
  }

  if (hasConcreteSignal(tweet)) {
    componentScores.specificity += 1;
  } else {
    componentScores.specificity -= 5;
    componentScores.nonGeneric -= 4;
    issues.push("Needs a more concrete noun, example, or claim");
  }

  if (/^i\b|^we\b|^you\b|^[A-Z0-9][^.!?]+[.!?]/i.test(tweet.trim())) {
    componentScores.hookQuality += 1;
  } else {
    componentScores.hookQuality -= 3;
    issues.push("Hook could be sharper");
  }

  const overlap = contextOverlap(tweet, context);
  if (overlap >= 2) {
    componentScores.ctaFit += 1;
    componentScores.brandVoiceMatch += 2;
  } else if (overlap === 0) {
    componentScores.ctaFit -= 2;
    issues.push("Does not connect tightly enough to the request context");
  }

  if (/#\w+/.test(tweet) && !/hashtag/i.test(context)) {
    componentScores.twitterNativeness -= 3;
    issues.push("Uses an unnecessary hashtag");
  }

  if (/\b\d+(?:%|x|k|m| million| billion)?\b/i.test(tweet) && !/\b\d/.test(context)) {
    componentScores.safetyFactuality -= 2;
    issues.push("Uses a numeric claim not present in the context");
  }

  componentScores.brandVoiceMatch = clamp(componentScores.brandVoiceMatch, 35);
  componentScores.twitterNativeness = clamp(componentScores.twitterNativeness, 20);
  componentScores.specificity = clamp(componentScores.specificity, 15);
  componentScores.hookQuality = clamp(componentScores.hookQuality, 10);
  componentScores.nonGeneric = clamp(componentScores.nonGeneric, 10);
  componentScores.ctaFit = clamp(componentScores.ctaFit, 5);
  componentScores.safetyFactuality = clamp(componentScores.safetyFactuality, 5);

  const bounded = Math.max(0, Math.min(100, totalScore(componentScores)));
  const hasHardIssue = issues.some((issue) => issue.startsWith("Uses avoided phrase") || issue.startsWith("Violates learned") || issue.includes("corporate launch copy"));

  return {
    score: bounded,
    scoreLabel: scoreLabel(bounded),
    reason: issues.length === 0 ? "Matches the skill file rules and stays specific." : "Needs revision against the skill file rules.",
    issues: Array.from(new Set(issues)),
    suggestedRevisionDirection:
      issues.length === 0 ? "Keep the structure and preserve the concrete phrasing." : "Make it more specific, less polished, and closer to the approved examples.",
    componentScores,
    shouldShow: bounded >= 70 && !hasHardIssue,
  };
}
