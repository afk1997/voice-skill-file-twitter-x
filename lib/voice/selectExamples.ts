import type { VoiceSkillFile } from "@/lib/types";

export type ExampleSample = {
  cleanedText: string;
  qualityScore: number;
  classification?: string;
};

export type SelectedExamples = {
  onBrand: string[];
  counterExamples: string[];
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
  hints,
  qualityScore = 70,
  approved = false,
}: {
  text: string;
  contextTerms: Set<string>;
  tweetTypeTerms: Set<string>;
  hints: VoiceSkillFile["retrievalHints"];
  qualityScore?: number;
  approved?: boolean;
}) {
  const textTerms = terms(text);
  const preferredVocabulary = new Set((hints?.preferredVocabulary ?? []).map((term) => term.toLowerCase()));
  const preferredTopics = new Set((hints?.preferredTopics ?? []).map((term) => term.toLowerCase()));
  const avoidVocabulary = new Set((hints?.avoidVocabulary ?? []).map((term) => term.toLowerCase()));
  const lower = text.toLowerCase();
  const avoidPenalty = Array.from(avoidVocabulary).some((term) => term && lower.includes(term)) ? 30 : 0;

  return (
    overlapScore(contextTerms, textTerms) * 12 +
    overlapScore(tweetTypeTerms, textTerms) * 5 +
    overlapScore(preferredVocabulary, textTerms) * 5 +
    overlapScore(preferredTopics, textTerms) * 7 +
    Math.round(qualityScore / 10) +
    (approved ? 18 : 0) -
    avoidPenalty
  );
}

export function selectExamplesForGeneration({
  context,
  tweetType,
  skillFile,
  samples,
  limit = 8,
}: {
  context: string;
  tweetType: string;
  skillFile: VoiceSkillFile;
  samples: ExampleSample[];
  limit?: number;
}): SelectedExamples {
  const contextTerms = terms(context);
  const tweetTypeTerms = terms(tweetType);
  const scoredSamples = samples
    .map((sample) => ({
      text: sample.cleanedText,
      score: scoreText({
        text: sample.cleanedText,
        contextTerms,
        tweetTypeTerms,
        hints: skillFile.retrievalHints,
        qualityScore: sample.qualityScore,
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
        hints: skillFile.retrievalHints,
        approved: example.approved,
      }),
    }))
    .sort((a, b) => b.score - a.score);

  return {
    onBrand: unique([...scoredSamples.map((sample) => sample.text), ...scoredLibrary.map((example) => example.text)], limit),
    counterExamples: unique([...(skillFile.exampleLibrary.rejectedGenerated ?? []), ...(skillFile.exampleLibrary.offBrand ?? [])], 4),
  };
}
