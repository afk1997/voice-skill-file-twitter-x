import type { CleanedTweet } from "@/lib/types";

const ENTITY_MAP: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": "\"",
  "&#39;": "'",
  "&nbsp;": " ",
};

export function cleanTweet(rawText: string): CleanedTweet {
  const decoded = Object.entries(ENTITY_MAP).reduce(
    (text, [entity, value]) => text.replaceAll(entity, value),
    rawText,
  );

  const withoutUrls = decoded.replace(/https?:\/\/\S+/gi, "").replace(/\bt\.co\/\S+/gi, "");
  const cleanedText = withoutUrls.replace(/\s+/g, " ").trim();

  return {
    rawText,
    cleanedText,
  };
}
