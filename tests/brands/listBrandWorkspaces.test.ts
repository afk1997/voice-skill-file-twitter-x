import { describe, expect, it, vi } from "vitest";
import { brandWorkspaceQuery, listBrandWorkspaces } from "@/lib/brands/listBrandWorkspaces";

describe("listBrandWorkspaces", () => {
  it("returns brand workspaces from the database", async () => {
    const brand = {
      id: "brand_1",
      name: "Metrom",
      twitterHandle: "@metromxyz",
      category: null,
      _count: { contentSamples: 12, skillFiles: 2 },
      skillFiles: [{ version: "v1.2" }],
    };
    const load = vi.fn().mockResolvedValue([brand]);

    const result = await listBrandWorkspaces(load);

    expect(result).toEqual({ brands: [brand], loadError: null });
    expect(load).toHaveBeenCalledOnce();
    expect(brandWorkspaceQuery).toEqual({
      orderBy: { updatedAt: "desc" },
      include: {
        _count: { select: { contentSamples: true, skillFiles: true } },
        skillFiles: { orderBy: { createdAt: "desc" }, take: 1 },
      },
    });
  });

  it("returns an empty result with an error message when the database is unavailable", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const load = vi.fn().mockRejectedValue(new Error("database unavailable"));

    const result = await listBrandWorkspaces(load);

    expect(result).toEqual({
      brands: [],
      loadError: "Brand workspaces could not be loaded. Check the database connection and try again.",
    });
    expect(errorSpy).toHaveBeenCalledOnce();

    errorSpy.mockRestore();
  });
});
