import { describe, expect, it } from "vitest";
import { getSkillFileHealth } from "@/lib/voice/skillFileHealth";

describe("getSkillFileHealth", () => {
  it("marks a Skill File without corpus profile as missing corpus evidence", () => {
    const health = getSkillFileHealth({
      skillFile: {
        modelNotes: { corpusSampleCount: 8 },
      },
      usefulSampleCount: 582,
    });

    expect(health.label).toBe("Missing corpus profile");
    expect(health.corpusBacked).toBe(false);
    expect(health.corpusSampleCount).toBe(8);
  });

  it("marks a corpus-backed Skill File as ready when it is current", () => {
    const health = getSkillFileHealth({
      skillFile: {
        corpusProfile: { sampleCount: 582 },
        voiceKernel: { stylometry: { topCharacterTrigrams: ["met"] } },
        modelNotes: { corpusSampleCount: 582 },
      },
      usefulSampleCount: 582,
      skillCreatedAt: new Date("2026-04-26T10:00:00Z"),
      latestUploadCreatedAt: new Date("2026-04-26T09:00:00Z"),
      latestReportCreatedAt: new Date("2026-04-26T09:30:00Z"),
    });

    expect(health.label).toBe("Corpus-backed");
    expect(health.corpusBacked).toBe(true);
    expect(health.isStale).toBe(false);
  });

  it("recommends refresh when a corpus-backed Skill File lacks the stylometric kernel", () => {
    const health = getSkillFileHealth({
      skillFile: {
        corpusProfile: { sampleCount: 582 },
        modelNotes: { corpusSampleCount: 582 },
      },
      usefulSampleCount: 582,
    });

    expect(health.label).toBe("Refresh recommended");
    expect(health.description).toContain("stylometric");
  });

  it("marks a Skill File as stale when newer uploads or reports exist", () => {
    const health = getSkillFileHealth({
      skillFile: {
        corpusProfile: { sampleCount: 582 },
        voiceKernel: { stylometry: { topCharacterTrigrams: ["met"] } },
        modelNotes: { corpusSampleCount: 582 },
      },
      usefulSampleCount: 582,
      skillCreatedAt: new Date("2026-04-26T10:00:00Z"),
      latestUploadCreatedAt: new Date("2026-04-26T11:00:00Z"),
    });

    expect(health.label).toBe("Refresh recommended");
    expect(health.isStale).toBe(true);
  });
});
