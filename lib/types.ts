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
  ruleEvidence?: {
    rule: string;
    confidence: number;
    evidence: {
      quote: string;
      reason: string;
    }[];
  }[];
};

export type SkillRule = {
  id: string;
  layer: "identity" | "mechanics" | "context" | "examples" | "feedback";
  rule: string;
  confidence: number;
  supportingExamples: string[];
  counterExamples: string[];
  appliesTo: string[];
};

export type VoiceKernel = {
  sampleCount: number;
  length: {
    idealRange: [number, number];
    median: number;
    p90: number;
    band: "short" | "medium" | "long" | "mixed";
  };
  formatting: {
    lineBreakRate: number;
    commonLineBreakTemplates: string[];
    emojiFrequency: "none" | "low" | "medium" | "high";
    commonEmojis: string[];
    hashtagRate: number;
    mentionRate: number;
    urlRate: number;
  };
  rhythm: {
    openingPatterns: string[];
    endingPatterns: string[];
    punctuationHabit: string;
    capitalizationHabit: string;
    firstPersonRate: number;
    secondPersonRate: number;
  };
  vocabulary: {
    preferredTerms: string[];
    preferredPhrases: string[];
    forbiddenModelDefaults: string[];
  };
  stylometry?: {
    topCharacterTrigrams: string[];
    punctuationDensity: number;
    averageWordCount: number;
    questionRate: number;
    exclamationRate: number;
  };
  generationRules: string[];
};

export type VoiceSkillFile = {
  schemaVersion?: "2.0";
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
  modelNotes?: {
    preferredQualityModel: string;
    generatedWith?: string;
    corpusSampleCount: number;
  };
  corpusProfile?: Record<string, unknown>;
  voiceKernel?: VoiceKernel;
  rules?: SkillRule[];
  retrievalHints?: {
    preferredTopics: string[];
    preferredStructures: string[];
    preferredVocabulary: string[];
    avoidVocabulary: string[];
  };
  updatedAt: string;
};

export type ProviderName = "anthropic" | "openai" | "openrouter" | "openai-compatible";

export type LlmProviderConfig = {
  provider?: ProviderName;
  apiKey?: string;
  model?: string;
  embeddingModel?: string;
  baseUrl?: string;
  contextWindowTokens?: number;
};

export type EvaluationComponentScores = {
  brandVoiceMatch: number;
  twitterNativeness: number;
  specificity: number;
  hookQuality: number;
  nonGeneric: number;
  ctaFit: number;
  safetyFactuality: number;
};

export type StyleDistanceMetadata = {
  score: number;
  issues: string[];
  metrics: {
    lengthFit: number;
    formatFit: number;
    vocabularyFit: number;
    stylometryFit: number;
    nearestExampleSimilarity: number;
  };
  nearestExample?: {
    text: string;
    similarity: number;
  };
};

export type GeneratedTweetResult = {
  id?: string;
  text: string;
  score: number;
  scoreLabel: string;
  reason: string;
  issues: string[];
  suggestedRevisionDirection: string;
  componentScores?: EvaluationComponentScores;
  evaluationMetadata?: {
    componentScores?: EvaluationComponentScores;
    styleDistance?: StyleDistanceMetadata;
    retryCount?: number;
    provenance?: {
      skillFileVersion?: string;
      retrievalMode?: "hybrid" | "voice-only";
      selectedExamples: string[];
      counterExamples: string[];
    };
  };
  shouldShow?: boolean;
};
