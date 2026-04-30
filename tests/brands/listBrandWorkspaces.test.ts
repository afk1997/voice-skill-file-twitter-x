import { describe, expect, it, vi } from "vitest";
import { listBrandWorkspaces, scopedBrandWorkspaceQuery } from "@/lib/brands/listBrandWorkspaces";

describe("listBrandWorkspaces", () => {
  it("loads only brands owned by the current profile", async () => {
    const brand = {
      id: "brand_1",
      name: "Metrom",
      twitterHandle: "@metromxyz",
      category: null,
      _count: { contentSamples: 12, skillFiles: 2 },
      skillFiles: [{ version: "v1.2" }],
    };
    const findMany = vi.fn().mockResolvedValue([brand]);

    const result = await listBrandWorkspaces("profile1", (query) => findMany(query));

    expect(result).toEqual({ brands: [brand], loadError: null });
    expect(findMany).toHaveBeenCalledWith(scopedBrandWorkspaceQuery("profile1"));
    expect(findMany.mock.calls[0][0].where).toEqual({
      memberships: { some: { userProfileId: "profile1" } },
    });
    expect(scopedBrandWorkspaceQuery("profile1")).toEqual({
      where: {
        memberships: { some: { userProfileId: "profile1" } },
      },
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

    const result = await listBrandWorkspaces("profile1", load);

    expect(result).toEqual({
      brands: [],
      loadError: "Brand workspaces could not be loaded. Check the database connection and try again.",
    });
    expect(errorSpy).toHaveBeenCalledOnce();

    errorSpy.mockRestore();
  });
});
