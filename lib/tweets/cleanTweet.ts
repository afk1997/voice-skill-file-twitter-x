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

  const withoutQuoteContext = decoded.replace(/\s*\[Quote tweet[^\]]*\]:?[\s\S]*$/i, "");
  const withoutMediaAnnotations = withoutQuoteContext.replace(
    /\s*\[(?:Image(?:\s+showing)?|Screenshot(?:\s+showing)?|Video thumbnail|Link card):?[^\]]*\]/gi,
    "",
  );
  const withoutUrls = withoutMediaAnnotations.replace(/https?:\/\/\S+/gi, "").replace(/\bt\.co\/\S+/gi, "");
  const cleanedText = withoutUrls
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.replace(/[ \t]+/g, " ").trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return {
    rawText,
    cleanedText,
  };
}
