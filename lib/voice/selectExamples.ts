import type { VoiceSkillFile } from "@/lib/types";
import { hasAvailabilityClaim, requestSupportsAvailabilityClaim } from "@/lib/voice/requestClaims";

export type ExampleSample = {
  id?: string;
  cleanedText: string;
  qualityScore: number;
  classification?: string | null;
  embedding?: number[];
};

export type SelectedExamples = {
  onBrand: string[];
  counterExamples: string[];
  retrievalMode: "hybrid" | "voice-only";
};

const STOP_WORDS = new Set([
  "the",
  "and",
  "for",
  "that",
  "with",
  "this",
  "are",
  "you",
  "your",
  "our",
  "from",
  "into",
  "when",
  "they",
  "write",
  "tweet",
  "about",
]);
const THREAD_MARKER_PATTERN = /^\s*\d+\s*\//;

function isThreadTweetType(tweetType: string) {
  return /\bthread\b/i.test(tweetType);
}

function terms(value: string) {
  return new Set(
    (value.toLowerCase().match(/[a-z][a-z0-9']+/g) ?? []).filter((term) => term.length > 2 && !STOP_WORDS.has(term)),
  );
}

function overlapScore(source: Set<string>, target: Set<string>) {
  let score = 0;
  for (const term of source) {
    if (target.has(term)) score += 1;
  }
  return score;
}

function cosineSimilarity(source?: number[], target?: number[]) {
  if (!source || !target || source.length === 0 || source.length !== target.length) return 0;
  let dot = 0;
  let sourceMagnitude = 0;
  let targetMagnitude = 0;
  for (let index = 0; index < source.length; index += 1) {
    dot += source[index] * target[index];
    sourceMagnitude += source[index] ** 2;
    targetMagnitude += target[index] ** 2;
  }
  if (sourceMagnitude === 0 || targetMagnitude === 0) return 0;
  return dot / (Math.sqrt(sourceMagnitude) * Math.sqrt(targetMagnitude));
}

function lineBreakTemplate(text: string) {
  return text
    .split("\n")
    .map((line) => {
      if (!line.trim()) return "<blank>";
      if (/^\s*\d+(?:[.)]|\s*\/)/.test(line)) return "<numbered>";
      if (/^\s*[-*•]/.test(line)) return "<bullet>";
      return "<line>";
    })
    .join("\n");
}

function structureScore(text: string, tweetType: string, skillFile: VoiceSkillFile) {
  const kernel = skillFile.voiceKernel;
  if (!kernel) return 0;

  let score = 0;
  const lower = text.toLowerCase();
  const template = lineBreakTemplate(text);
  const hasLineBreak = text.includes("\n");
  const [minLength, maxLength] = kernel.length.idealRange;
  const isThreadType = isThreadTweetType(tweetType);

  if (kernel.formatting.commonLineBreakTemplates.includes(template)) score += 18;
  if (kernel.formatting.lineBreakRate >= 45 && hasLineBreak) score += 24;
  if (kernel.formatting.lineBreakRate <= 10 && !hasLineBreak) score += 8;
  if (isThreadType && hasLineBreak) score += 8;
  if (!isThreadType && THREAD_MARKER_PATTERN.test(text)) score -= 24;
  if (text.length >= minLength && text.length <= maxLength) score += 8;
  if (text.length > kernel.length.p90) score -= 8;
  if (kernel.formatting.hashtagRate <= 5 && /#\w+/.test(text)) score -= 10;
  if (kernel.formatting.emojiFrequency === "none" && /\p{Extended_Pictographic}/u.test(text)) score -= 8;

  for (const pattern of kernel.rhythm.openingPatterns.slice(0, 8)) {
    const firstTerms = Array.from(terms(pattern)).slice(0, 3);
    if (firstTerms.length > 0 && firstTerms.every((term) => lower.includes(term))) {
      score += 8;
      break;
    }
  }

  return score;
}

function unique(values: string[], limit: number) {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const text = value.trim();
    const key = text.toLowerCase();
    if (!text || seen.has(key)) continue;
    seen.add(key);
    result.push(text);
    if (result.length >= limit) break;
  }
  return result;
}

function scoreText({
  text,
  contextTerms,
  tweetTypeTerms,
  tweetType,
  skillFile,
  qualityScore = 70,
  approved = false,
  contextEmbedding,
  embedding,
  classification,
  supportsAvailabilityClaims,
}: {
  text: string;
  contextTerms: Set<string>;
  tweetTypeTerms: Set<string>;
  tweetType: string;
  skillFile: VoiceSkillFile;
  qualityScore?: number;
  approved?: boolean;
  contextEmbedding?: number[];
  embedding?: number[];
  classification?: string | null;
  supportsAvailabilityClaims: boolean;
}) {
  const textTerms = terms(text);
  const hints = skillFile.retrievalHints;
  const preferredVocabulary = new Set((hints?.preferredVocabulary ?? []).map((term) => term.toLowerCase()));
  const preferredTopics = new Set((hints?.preferredTopics ?? []).map((term) => term.toLowerCase()));
  const avoidVocabulary = new Set((hints?.avoidVocabulary ?? []).map((term) => term.toLowerCase()));
  const lower = text.toLowerCase();
  const avoidPenalty = Array.from(avoidVocabulary).some((term) => term && lower.includes(term)) ? 30 : 0;
  const semanticScore = Math.max(0, cosineSimilarity(contextEmbedding, embedding)) * 42;
  const threadMismatchPenalty =
    !isThreadTweetType(tweetType) && (classification === "thread_candidate" || THREAD_MARKER_PATTERN.test(text)) ? 18 : 0;
  const availabilityMismatchPenalty = !supportsAvailabilityClaims && hasAvailabilityClaim(text) ? 28 : 0;

  return (
    semanticScore +
    overlapScore(contextTerms, textTerms) * 12 +
    overlapScore(tweetTypeTerms, textTerms) * 5 +
    overlapScore(preferredVocabulary, textTerms) * 5 +
    overlapScore(preferredTopics, textTerms) * 7 +
    structureScore(text, tweetType, skillFile) +
    Math.round(qualityScore / 10) +
    (approved ? 18 : 0) -
    avoidPenalty -
    threadMismatchPenalty -
    availabilityMismatchPenalty
  );
}

function safeEvidenceForRequest(text: string, tweetType: string, supportsAvailabilityClaims: boolean) {
  if (!isThreadTweetType(tweetType) && THREAD_MARKER_PATTERN.test(text)) return false;
  if (!supportsAvailabilityClaims && hasAvailabilityClaim(text)) return false;
  return true;
}

export function selectExamplesForGeneration({
  context,
  tweetType,
  notes,
  skillFile,
  samples,
  limit = 8,
  contextEmbedding,
}: {
  context: string;
  tweetType: string;
  notes?: string;
  skillFile: VoiceSkillFile;
  samples: ExampleSample[];
  limit?: number;
  contextEmbedding?: number[];
}): SelectedExamples {
  const requestContext = [context, notes].filter(Boolean).join("\n");
  const contextTerms = terms(requestContext);
  const tweetTypeTerms = terms(tweetType);
  const supportsAvailabilityClaims = requestSupportsAvailabilityClaim({ context, tweetType, notes });
  const retrievalMode = contextEmbedding && samples.some((sample) => sample.embedding) ? "hybrid" : "voice-only";
  const semanticPool =
    retrievalMode === "hybrid"
      ? samples
          .map((sample) => ({
            sample,
            semanticSimilarity: cosineSimilarity(contextEmbedding, sample.embedding),
          }))
          .sort((a, b) => b.semanticSimilarity - a.semanticSimilarity)
          .slice(0, Math.max(80, limit * 24))
          .map((item) => item.sample)
      : samples;

  const scoredSamples = semanticPool
    .map((sample) => ({
      text: sample.cleanedText,
      score: scoreText({
        text: sample.cleanedText,
        contextTerms,
        tweetTypeTerms,
        tweetType,
        skillFile,
        qualityScore: sample.qualityScore,
        contextEmbedding,
        embedding: sample.embedding,
        classification: sample.classification,
        supportsAvailabilityClaims,
      }),
    }))
    .sort((a, b) => b.score - a.score);

  const scoredLibrary = [
    ...(skillFile.exampleLibrary.onBrand ?? []).map((text) => ({ text, approved: false })),
    ...(skillFile.exampleLibrary.approvedGenerated ?? []).map((text) => ({ text, approved: true })),
  ]
    .map((example) => ({
      text: example.text,
      score: scoreText({
        text: example.text,
        contextTerms,
        tweetTypeTerms,
        tweetType,
        skillFile,
        approved: example.approved,
        supportsAvailabilityClaims,
      }),
    }))
    .sort((a, b) => b.score - a.score);

  const onBrandCandidates = [...scoredSamples.map((sample) => sample.text), ...scoredLibrary.map((example) => example.text)].filter((text) =>
    safeEvidenceForRequest(text, tweetType, supportsAvailabilityClaims),
  );

  return {
    onBrand: unique(onBrandCandidates, limit),
    counterExamples: unique([...(skillFile.exampleLibrary.rejectedGenerated ?? []), ...(skillFile.exampleLibrary.offBrand ?? [])], 4),
    retrievalMode,
  };
}
