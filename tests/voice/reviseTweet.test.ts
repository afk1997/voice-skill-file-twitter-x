import { describe, expect, it } from "vitest";
import { buildRevisionContext } from "@/lib/voice/reviseTweet";

describe("buildRevisionContext", () => {
  it("keeps the original idea and exact draft while asking for a replacement", () => {
    const context = buildRevisionContext({
      originalPrompt: "Announce Solana deployment for Metrom.",
      originalTweet: "Solana just got programmable incentives — set targets.",
      feedbackNotes: ["Save note only: Please don't use em-dashes."],
      revisionNotes: ["Make it less hype and mention LPs."],
    });

    expect(context).toContain("Original request:\nAnnounce Solana deployment for Metrom.");
    expect(context).toContain("Draft to revise:\nSolana just got programmable incentives — set targets.");
    expect(context).toContain("Return one improved replacement");
    expect(context).toContain("Please don't use em-dashes");
    expect(context).toContain("Revision note for this run:");
    expect(context).toContain("Make it less hype and mention LPs.");
  });
});
