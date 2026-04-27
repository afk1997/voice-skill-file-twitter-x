import { parse } from "csv-parse/sync";
import JSZip from "jszip";
import { MAX_IMPORT_ITEMS } from "@/lib/constants";
import type { ParsedTweet } from "@/lib/types";

type ParseResult = {
  tweets: ParsedTweet[];
  totalFound: number;
};

export function stripTwitterAssignment(content: string) {
  const trimmed = content.trim().replace(/;$/, "");
  const assignmentIndex = trimmed.indexOf("=");
  if (assignmentIndex > -1 && trimmed.slice(0, assignmentIndex).match(/(window\.YTD|var\s+\w+|\w+)/)) {
    return trimmed.slice(assignmentIndex + 1).trim();
  }
  return trimmed;
}

function toNumber(value: unknown): number | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : undefined;
}

function extractEntities(source: Record<string, unknown>) {
  const entities = source.entities as Record<string, unknown> | undefined;
  const hashtags = Array.isArray(entities?.hashtags)
    ? entities.hashtags.map((item) => String((item as Record<string, unknown>).text ?? "")).filter(Boolean)
    : [];
  const mentions = Array.isArray(entities?.user_mentions)
    ? entities.user_mentions.map((item) => String((item as Record<string, unknown>).screen_name ?? "")).filter(Boolean)
    : [];
  const urls = Array.isArray(entities?.urls)
    ? entities.urls
        .map((item) => String((item as Record<string, unknown>).expanded_url ?? (item as Record<string, unknown>).url ?? ""))
        .filter(Boolean)
    : [];

  return { hashtags, mentions, urls };
}

function normalizeTweetObject(item: unknown): ParsedTweet | null {
  const wrapper = item as Record<string, unknown>;
  const source = (wrapper.tweet && typeof wrapper.tweet === "object" ? wrapper.tweet : wrapper) as Record<string, unknown>;
  const rawText = String(source.full_text ?? source.text ?? source.tweet ?? source.content ?? "").trim();

  if (!rawText) return null;

  const entities = extractEntities(source);

  return {
    rawText,
    createdAt: source.created_at ? String(source.created_at) : undefined,
    favoriteCount: toNumber(source.favorite_count ?? source.favoriteCount ?? source.likes),
    retweetCount: toNumber(source.retweet_count ?? source.retweetCount ?? source.retweets),
    replyToTweetId: source.in_reply_to_status_id_str ? String(source.in_reply_to_status_id_str) : undefined,
    hashtags: entities.hashtags,
    mentions: entities.mentions,
    urls: entities.urls,
    language: source.lang ? String(source.lang) : undefined,
    metadata: source,
  };
}

function parseJsonLike(content: string): ParseResult {
  const json = JSON.parse(stripTwitterAssignment(content)) as unknown;
  const record = json as Record<string, unknown>;
  const items: unknown[] = Array.isArray(json)
    ? json
    : Array.isArray(record.tweets)
      ? record.tweets
      : Array.isArray(record.data)
        ? record.data
        : [json];
  const normalized = items.map(normalizeTweetObject).filter((tweet): tweet is ParsedTweet => Boolean(tweet));
  return { tweets: normalized.slice(0, MAX_IMPORT_ITEMS), totalFound: normalized.length };
}

function parseCsv(content: string): ParseResult {
  const records = parse(content, { columns: true, skip_empty_lines: true, trim: true }) as Record<string, string>[];
  const normalized = records
    .map((record) =>
      normalizeTweetObject({
        text: record.text ?? record.tweet ?? record.full_text ?? record.content,
        created_at: record.created_at ?? record.date,
        favorite_count: record.favorite_count ?? record.likes,
        retweet_count: record.retweet_count ?? record.retweets,
        lang: record.lang ?? record.language,
      }),
    )
    .filter((tweet): tweet is ParsedTweet => Boolean(tweet));
  return { tweets: normalized.slice(0, MAX_IMPORT_ITEMS), totalFound: normalized.length };
}

const TXT_SEPARATOR_PATTERN = /^\s*_{5,}\s*$/m;
const TXT_DATE_HEADER_PATTERN =
  /^((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)\s+\d{1,2},\s+\d{4})(?:\s+\(([^)]+)\))?$/i;
const TXT_INLINE_DATE_HEADER_PATTERN =
  /^((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)\s+\d{1,2},\s+\d{4})(?:\s+\(([^)]+)\))?\s+([\s\S]+)$/i;

function extractTextMetadata(rawText: string) {
  return {
    hashtags: Array.from(rawText.matchAll(/#(\w+)/g)).map((match) => match[1]),
    mentions: Array.from(rawText.matchAll(/@(\w+)/g)).map((match) => match[1]),
    urls: Array.from(rawText.matchAll(/https?:\/\/\S+/g)).map((match) => match[0]),
  };
}

function timelineMetadata(replyContext?: string) {
  return {
    isReply: Boolean(replyContext?.toLowerCase().includes("reply")),
    replyContext,
  };
}

function textTweet(rawText: string, metadata: Record<string, unknown> = {}, createdAt?: string): ParsedTweet {
  const inlineHeader = createdAt ? undefined : rawText.trim().match(TXT_INLINE_DATE_HEADER_PATTERN);
  const text = inlineHeader ? inlineHeader[3].trim() : rawText;
  const inlineMetadata = inlineHeader ? { header: inlineHeader[0], ...timelineMetadata(inlineHeader[2]?.trim()) } : {};
  const entities = extractTextMetadata(text);
  return {
    rawText: text,
    createdAt: createdAt ?? inlineHeader?.[1],
    hashtags: entities.hashtags,
    mentions: entities.mentions,
    urls: entities.urls,
    metadata: { ...metadata, ...inlineMetadata },
  };
}

function trimEmptyEdges(lines: string[]) {
  const firstContentLine = lines.findIndex((line) => line.trim().length > 0);
  if (firstContentLine === -1) return [];

  let lastContentLine = lines.length - 1;
  while (lastContentLine >= firstContentLine && lines[lastContentLine].trim().length === 0) {
    lastContentLine -= 1;
  }

  return lines.slice(firstContentLine, lastContentLine + 1);
}

function normalizeFormattedLines(lines: string[]) {
  return trimEmptyEdges(lines)
    .map((line) => line.replace(/[ \t]+/g, " ").trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function parseTimelineTxt(content: string): ParseResult {
  const blocks = content
    .split(/^\s*_{5,}\s*$/gm)
    .filter((block) => block.trim().length > 0);

  const tweets = blocks
    .map((block) => {
      const lines = trimEmptyEdges(block.split("\n"));
      if (lines.length === 0) return null;

      const header = lines[0].trim();
      const headerMatch = header.match(TXT_DATE_HEADER_PATTERN);
      const createdAt = headerMatch?.[1];
      const replyContext = headerMatch?.[2]?.trim();
      const textLines = headerMatch ? lines.slice(1) : lines;
      const rawText = normalizeFormattedLines(textLines);
      if (!rawText) return null;

      return textTweet(
        rawText,
        {
          sourceType: "timeline_txt",
          header: headerMatch ? header : undefined,
          ...timelineMetadata(replyContext),
        },
        createdAt,
      );
    })
    .filter((tweet): tweet is ParsedTweet => Boolean(tweet));

  return { tweets: tweets.slice(0, MAX_IMPORT_ITEMS), totalFound: tweets.length };
}

function parseTxt(content: string): ParseResult {
  const normalized = content.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n");

  if (TXT_SEPARATOR_PATTERN.test(normalized)) {
    return parseTimelineTxt(normalized);
  }

  const chunks = normalized
    .split(/\n\s*\n/g)
    .map((chunk) => chunk.trim())
    .filter(Boolean);
  const fallback = chunks.length > 1 ? chunks : normalized.split(/\n/g).map((line) => line.trim()).filter(Boolean);
  const tweets = fallback.map((rawText) => textTweet(rawText));
  return { tweets: tweets.slice(0, MAX_IMPORT_ITEMS), totalFound: tweets.length };
}

export async function parseTweetTextContent(fileName: string, content: string): Promise<ParseResult> {
  const lowerName = fileName.toLowerCase();
  if (lowerName.endsWith(".csv")) return parseCsv(content);
  if (lowerName.endsWith(".txt")) return parseTxt(content);
  return parseJsonLike(content);
}

export async function parseTweetFile(fileName: string, bytes: ArrayBuffer): Promise<ParseResult> {
  if (fileName.toLowerCase().endsWith(".zip")) {
    const zip = await JSZip.loadAsync(bytes);
    const candidates = Object.values(zip.files).filter((file) => {
      const name = file.name.toLowerCase();
      return !file.dir && (name.endsWith("tweets.js") || name.includes("tweets") || name.endsWith(".json"));
    });

    const parsed: ParsedTweet[] = [];
    let totalFound = 0;

    for (const file of candidates) {
      const text = await file.async("string");
      const result = await parseTweetTextContent(file.name, text);
      totalFound += result.totalFound;
      parsed.push(...result.tweets);
      if (parsed.length >= MAX_IMPORT_ITEMS) break;
    }

    return { tweets: parsed.slice(0, MAX_IMPORT_ITEMS), totalFound };
  }

  const content = Buffer.from(bytes).toString("utf8");
  return parseTweetTextContent(fileName, content);
}
