import type { SkillRule, VoiceReport, VoiceSkillFile } from "@/lib/types";
import { buildCorpusProfile, type CorpusProfileInput } from "@/lib/voice/corpusProfile";
import { createVoiceSkillFile } from "@/lib/voice/createSkillFile";
import { nextSkillVersion } from "@/lib/voice/versioning";

type BrandInput = {
  name: string;
  audience?: string | null;
  beliefs?: string | null;
  avoidSoundingLike?: string | null;
};

function unique(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

function mergeRules(current: SkillRule[] = [], previous: SkillRule[] = []) {
  const merged = new Map<string, SkillRule>();
  for (const rule of current) {
    merged.set(rule.id, rule);
  }
  for (const rule of previous.filter((item) => item.layer === "feedback")) {
    merged.set(rule.id, rule);
  }
  return Array.from(merged.values());
}

function preserveFeedbackLearning(skillFile: VoiceSkillFile, previousSkillFile?: VoiceSkillFile | null): VoiceSkillFile {
  if (!previousSkillFile) return skillFile;

  return {
    ...skillFile,
    preferredPhrases: unique([...skillFile.preferredPhrases, ...previousSkillFile.preferredPhrases]),
    avoidedPhrases: unique([...skillFile.avoidedPhrases, ...previousSkillFile.avoidedPhrases]),
    exampleLibrary: {
      onBrand: skillFile.exampleLibrary.onBrand,
      offBrand: unique([...skillFile.exampleLibrary.offBrand, ...previousSkillFile.exampleLibrary.offBrand]),
      approvedGenerated: unique([
        ...skillFile.exampleLibrary.approvedGenerated,
        ...previousSkillFile.exampleLibrary.approvedGenerated,
      ]),
      rejectedGenerated: unique([
        ...skillFile.exampleLibrary.rejectedGenerated,
        ...previousSkillFile.exampleLibrary.rejectedGenerated,
      ]),
    },
    rules: mergeRules(skillFile.rules, previousSkillFile.rules),
    retrievalHints: {
      preferredTopics: unique([
        ...(skillFile.retrievalHints?.preferredTopics ?? []),
        ...(previousSkillFile.retrievalHints?.preferredTopics ?? []),
      ]),
      preferredStructures: unique([
        ...(skillFile.retrievalHints?.preferredStructures ?? []),
        ...(previousSkillFile.retrievalHints?.preferredStructures ?? []),
      ]),
      preferredVocabulary: unique([
        ...(skillFile.retrievalHints?.preferredVocabulary ?? []),
        ...(previousSkillFile.retrievalHints?.preferredVocabulary ?? []),
      ]),
      avoidVocabulary: unique([
        ...(skillFile.retrievalHints?.avoidVocabulary ?? []),
        ...(previousSkillFile.retrievalHints?.avoidVocabulary ?? []),
      ]),
    },
  };
}

export function buildSkillFileFromVoiceAnalysis({
  version,
  previousVersion,
  previousSkillFile,
  brand,
  report,
  samples,
  generatedWith,
}: {
  version?: string;
  previousVersion?: string | null;
  previousSkillFile?: VoiceSkillFile | null;
  brand: BrandInput;
  report: VoiceReport;
  samples: CorpusProfileInput[];
  generatedWith?: string;
}) {
  const nextVersion = version ?? nextSkillVersion(previousVersion);
  const corpusProfile = buildCorpusProfile(samples);
  const skillFile = preserveFeedbackLearning(createVoiceSkillFile({
    version: nextVersion,
    brand,
    report,
    corpusProfile,
    generatedWith,
  }), previousSkillFile);

  return {
    version: nextVersion,
    corpusProfile,
    skillFile,
  };
}
