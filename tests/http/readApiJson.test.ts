import { describe, expect, it } from "vitest";
import { readApiJson } from "@/lib/http/readApiJson";

describe("readApiJson", () => {
  it("returns a useful error object for an empty failed response", async () => {
    const response = new Response(null, { status: 500 });

    await expect(readApiJson(response)).resolves.toEqual({ error: "Request failed with status 500." });
  });

  it("returns an empty object for empty successful responses", async () => {
    await expect(readApiJson(new Response(""))).resolves.toEqual({});
  });
});
