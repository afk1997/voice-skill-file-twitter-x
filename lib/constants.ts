export const MAX_IMPORT_ITEMS = 5000;
export const MAX_ANALYSIS_SAMPLES = 200;

export const BANNED_AI_PHRASES = [
  "game-changing",
  "revolutionary",
  "unlock the future",
  "seamless",
  "in today's fast-paced world",
  "let's dive in",
  "supercharge",
  "cutting-edge",
  "we are excited to announce",
  "powerful solution",
  "transform the way",
];

export const TWEET_TYPES = [
  "single tweet",
  "thread",
  "founder opinion",
  "product update",
  "educational post",
  "contrarian take",
  "launch announcement",
  "soft CTA",
] as const;

export const FEEDBACK_LABELS = [
  "Sounds like us",
  "Too generic",
  "Too formal",
  "Too casual",
  "Too salesy",
  "Too polished",
  "Too long",
  "Too much hype",
  "Wrong vocabulary",
  "Good idea, wrong tone",
  "Good tone, weak hook",
] as const;
