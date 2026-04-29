import { describe, expect, it, vi } from "vitest";
import { STARTER_RULES } from "@/lib/rules/starterRules";
import { seedStarterRules } from "@/lib/rules/seedStarterRules";

describe("seedStarterRules", () => {
  it("upserts every starter rule by stable id", async () => {
    const upsert = vi.fn().mockResolvedValue({});
    await seedStarterRules({ ruleBankRule: { upsert } });

    expect(upsert).toHaveBeenCalledTimes(STARTER_RULES.length);
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "starter-fact-no-invented-claims" },
        update: expect.objectContaining({ source: "STARTER", scope: "GLOBAL", enabled: true }),
        create: expect.objectContaining({ id: "starter-fact-no-invented-claims", source: "STARTER", scope: "GLOBAL" }),
      }),
    );
  });
});
