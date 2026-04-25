export type TweetClassification =
  | "original"
  | "reply"
  | "quote"
  | "thread_candidate"
  | "link_only"
  | "retweet"
  | "too_short"
  | "noisy"
  | "useful";

export type ParsedTweet = {
  rawText: string;
  createdAt?: string;
  favoriteCount?: number;
  retweetCount?: number;
  replyToTweetId?: string;
  hashtags: string[];
  mentions: string[];
  urls: string[];
  language?: string;
  metadata: Record<string, unknown>;
};

export type CleanedTweet = {
  rawText: string;
  cleanedText: string;
};

export type ClassifiedTweet = ParsedTweet &
  CleanedTweet & {
    classification: TweetClassification;
    qualityScore: number;
    usedForVoice: boolean;
    duplicateKey: string;
  };

export type VoiceReport = {
  summary: string;
  personalityTraits: string[];
  toneSliders: {
    formalToCasual: number;
    seriousToFunny: number;
    respectfulToIrreverent: number;
    enthusiasticToMatterOfFact: number;
    simpleToComplex: number;
    warmToDetached: number;
  };
  linguisticMechanics: {
    averageTweetLength: number;
    sentenceLength: "short" | "medium" | "long" | "mixed";
    usesEmojis: boolean;
    emojiFrequency: "none" | "low" | "medium" | "high";
    punctuationStyle: string;
    capitalizationStyle: string;
    lineBreakStyle: string;
    firstPersonUsage: "low" | "medium" | "high";
    secondPersonUsage: "low" | "medium" | "high";
  };
  hookPatterns: string[];
  endingPatterns: string[];
  preferredPhrases: string[];
  avoidedPhrases: string[];
  contentPatterns: {
    name: string;
    description: string;
    structure: string;
  }[];
  exampleTweets: string[];
};

export type VoiceSkillFile = {
  version: string;
  brandName: string;
  voiceSummary: string;
  audience: string[];
  coreBeliefs: string[];
  coreVoiceIdentity: {
    traits: string[];
    thisNotThat: {
      this: string;
      notThat: string;
    }[];
  };
  toneSliders: VoiceReport["toneSliders"];
  linguisticRules: string[];
  contextualToneRules: {
    contentType: string;
    rules: string[];
  }[];
  preferredPhrases: string[];
  avoidedPhrases: string[];
  tweetPatterns: {
    name: string;
    structure: string;
    example?: string;
  }[];
  exampleLibrary: {
    onBrand: string[];
    offBrand: string[];
    approvedGenerated: string[];
    rejectedGenerated: string[];
  };
  qualityRubric: {
    brandVoiceMatch: number;
    twitterNativeness: number;
    specificity: number;
    hookQuality: number;
    nonGeneric: number;
    ctaFit: number;
  };
  updatedAt: string;
};

export type ProviderName = "mock" | "anthropic" | "openai" | "openrouter" | "openai-compatible";

export type LlmProviderConfig = {
  provider?: ProviderName;
  apiKey?: string;
  model?: string;
  baseUrl?: string;
};

export type GeneratedTweetResult = {
  id?: string;
  text: string;
  score: number;
  scoreLabel: string;
  reason: string;
  issues: string[];
  suggestedRevisionDirection: string;
};
