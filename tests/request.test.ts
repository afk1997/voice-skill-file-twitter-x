import { describe, expect, it } from "vitest";
import { jsonErrorFromUnknown } from "@/lib/request";

describe("jsonErrorFromUnknown", () => {
  it("returns a JSON response for thrown errors", async () => {
    const response = jsonErrorFromUnknown(new Error("Provider request failed."), "Could not analyze voice.", 502);

    expect(response.status).toBe(502);
    expect(response.headers.get("content-type")).toContain("application/json");
    await expect(response.json()).resolves.toEqual({ error: "Provider request failed." });
  });
});
