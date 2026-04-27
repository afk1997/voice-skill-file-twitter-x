type SkillFileHealthSource = {
  corpusProfile?: Record<string, unknown>;
  voiceKernel?: {
    stylometry?: {
      topCharacterTrigrams?: string[];
    };
  };
  modelNotes?: {
    corpusSampleCount?: number;
  };
};

export type SkillFileHealth = {
  label: "No Skill File" | "Missing corpus profile" | "Partial corpus" | "Corpus-backed" | "Refresh recommended";
  description: string;
  corpusBacked: boolean;
  isStale: boolean;
  corpusSampleCount: number;
  usefulSampleCount: number;
  coveragePercent: number;
};

function numeric(value: unknown) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) && numberValue > 0 ? Math.round(numberValue) : 0;
}

function isAfter(left?: Date | string | null, right?: Date | string | null) {
  if (!left || !right) return false;
  return new Date(left).getTime() > new Date(right).getTime();
}

export function getSkillFileHealth({
  skillFile,
  usefulSampleCount,
  skillCreatedAt,
  latestUploadCreatedAt,
  latestReportCreatedAt,
}: {
  skillFile?: SkillFileHealthSource | null;
  usefulSampleCount: number;
  skillCreatedAt?: Date | string | null;
  latestUploadCreatedAt?: Date | string | null;
  latestReportCreatedAt?: Date | string | null;
}): SkillFileHealth {
  if (!skillFile) {
    return {
      label: "No Skill File",
      description: "Analyze the uploaded writing samples to create a voice artifact.",
      corpusBacked: false,
      isStale: false,
      corpusSampleCount: 0,
      usefulSampleCount,
      coveragePercent: 0,
    };
  }

  const profileSampleCount = numeric(skillFile.corpusProfile?.sampleCount);
  const corpusSampleCount = profileSampleCount || numeric(skillFile.modelNotes?.corpusSampleCount);
  const corpusBacked = profileSampleCount > 0;
  const hasStylometry = Boolean(skillFile.voiceKernel?.stylometry?.topCharacterTrigrams?.length);
  const coveragePercent = usefulSampleCount > 0 ? Math.min(100, Math.round((corpusSampleCount / usefulSampleCount) * 100)) : 0;
  const isStale = isAfter(latestUploadCreatedAt, skillCreatedAt) || isAfter(latestReportCreatedAt, skillCreatedAt);

  if (isStale) {
    return {
      label: "Refresh recommended",
      description: "Newer upload or analysis data exists. Re-analyze to refresh the active Skill File.",
      corpusBacked,
      isStale,
      corpusSampleCount,
      usefulSampleCount,
      coveragePercent,
    };
  }

  if (!corpusBacked) {
    return {
      label: "Missing corpus profile",
      description: "This Skill File is not carrying corpus-level mechanics, so generation may rely on too few examples.",
      corpusBacked,
      isStale,
      corpusSampleCount,
      usefulSampleCount,
      coveragePercent,
    };
  }

  if (!hasStylometry) {
    return {
      label: "Refresh recommended",
      description: "This Skill File has corpus evidence but lacks the stylometric kernel used by the latest evaluator.",
      corpusBacked,
      isStale: true,
      corpusSampleCount,
      usefulSampleCount,
      coveragePercent,
    };
  }

  if (usefulSampleCount > 0 && coveragePercent < 50) {
    return {
      label: "Partial corpus",
      description: "The Skill File has corpus evidence, but it represents less than half of the useful samples.",
      corpusBacked,
      isStale,
      corpusSampleCount,
      usefulSampleCount,
      coveragePercent,
    };
  }

  return {
    label: "Corpus-backed",
    description: "The active Skill File includes corpus-level mechanics and retrieval hints from the useful samples.",
    corpusBacked,
    isStale,
    corpusSampleCount,
    usefulSampleCount,
    coveragePercent,
  };
}
