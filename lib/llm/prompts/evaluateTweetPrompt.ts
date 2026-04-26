import { BANNED_AI_PHRASES } from "@/lib/constants";
import type { VoiceSkillFile } from "@/lib/types";

export function evaluateTweetPrompt({
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
  return `Evaluate this Twitter/X draft against the Voice Skill File.

Return only valid JSON:
{
  "score": 0,
  "componentScores": {
    "brandVoiceMatch": 0,
    "twitterNativeness": 0,
    "specificity": 0,
    "hookQuality": 0,
    "nonGeneric": 0,
    "ctaFit": 0,
    "safetyFactuality": 0
  },
  "reason": "short reason",
  "issues": ["issue"],
  "suggestedRevisionDirection": "revision direction",
  "shouldShow": true
}

Weights:
- brandVoiceMatch: 35
- twitterNativeness: 20
- specificity: 15
- hookQuality: 10
- nonGeneric: 10
- ctaFit: 5
- safetyFactuality: 5

Penalize generic AI language, fake claims, unnecessary hashtags, and these phrases:
${BANNED_AI_PHRASES.join(", ")}

Tweet type: ${tweetType}
Context: ${context}
Tweet: ${tweet}
Voice Skill File: ${JSON.stringify(skillFile, null, 2)}`;
}

export function evaluateTweetsPrompt({
  tweets,
  context,
  tweetType,
  skillFile,
}: {
  tweets: string[];
  context: string;
  tweetType: string;
  skillFile: VoiceSkillFile;
}) {
  return `Evaluate these Twitter/X drafts against the Voice Skill File.

Return only valid JSON:
{
  "evaluations": [
    {
      "index": 0,
      "score": 0,
      "componentScores": {
        "brandVoiceMatch": 0,
        "twitterNativeness": 0,
        "specificity": 0,
        "hookQuality": 0,
        "nonGeneric": 0,
        "ctaFit": 0,
        "safetyFactuality": 0
      },
      "reason": "short reason",
      "issues": ["issue"],
      "suggestedRevisionDirection": "revision direction",
      "shouldShow": true
    }
  ]
}

Return exactly one evaluation for each draft index. Use the same weights:
- brandVoiceMatch: 35
- twitterNativeness: 20
- specificity: 15
- hookQuality: 10
- nonGeneric: 10
- ctaFit: 5
- safetyFactuality: 5

Penalize generic AI language, fake claims, unnecessary hashtags, off-brand vocabulary, and these phrases:
${BANNED_AI_PHRASES.join(", ")}

Tweet type: ${tweetType}
Context: ${context}

Drafts:
${tweets.map((tweet, index) => `${index}. ${tweet}`).join("\n\n")}

Voice Skill File: ${JSON.stringify(skillFile, null, 2)}`;
}
