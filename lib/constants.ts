export const MAX_IMPORT_ITEMS = 5000;
export const MAX_ANALYSIS_SAMPLES = 200;
export const MAX_CORPUS_ANALYSIS_SAMPLES = 5000;
export const MAX_LLM_ANALYSIS_SAMPLE_CHARS = 5200;
export const MAX_DIRECT_ANALYSIS_SAMPLE_CHARS = 50000;
export const MAX_CHUNKED_ANALYSIS_SAMPLE_CHARS = 20000;
export const HIGH_CONTEXT_ANALYSIS_THRESHOLD_TOKENS = 16000;
export const DEFAULT_HIGH_CONTEXT_WINDOW_TOKENS = 32000;
export const DEFAULT_LOW_CONTEXT_WINDOW_TOKENS = 4096;

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
  "Save note only",
] as const;
