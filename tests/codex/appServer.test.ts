import { describe, expect, it } from "vitest";
import { buildCodexPrompt, sanitizeAccountRead, sanitizeRateLimits } from "@/lib/codex/appServer";

describe("Codex app-server bridge helpers", () => {
  it("sanitizes ChatGPT account data without exposing tokens", () => {
    expect(
      sanitizeAccountRead({
        account: {
          type: "chatgpt",
          email: "user@example.com",
          planType: "plus",
          accessToken: "secret",
        },
        requiresOpenaiAuth: true,
      }),
    ).toEqual({
      connected: true,
      requiresOpenaiAuth: true,
      account: {
        type: "chatgpt",
        email: "user@example.com",
        planType: "plus",
      },
    });
  });

  it("sanitizes disconnected account state", () => {
    expect(sanitizeAccountRead({ account: null, requiresOpenaiAuth: true })).toEqual({
      connected: false,
      requiresOpenaiAuth: true,
      account: null,
    });
  });

  it("sanitizes primary rate-limit data", () => {
    expect(
      sanitizeRateLimits({
        rateLimits: {
          limitId: "codex",
          primary: { usedPercent: 42, windowDurationMins: 15, resetsAt: 1730947200 },
          rateLimitReachedType: null,
        },
      }),
    ).toEqual({
      limitId: "codex",
      usedPercent: 42,
      windowDurationMins: 15,
      resetsAt: 1730947200,
      rateLimitReachedType: null,
    });
  });

  it("wraps prompts so Codex returns content only", () => {
    expect(buildCodexPrompt("Return {\"ok\":true}.")).toContain("Return only the final answer text");
    expect(buildCodexPrompt("Return {\"ok\":true}.")).toContain("Do not edit files");
    expect(buildCodexPrompt("Return {\"ok\":true}.")).toContain("Return {\"ok\":true}.");
  });
});
