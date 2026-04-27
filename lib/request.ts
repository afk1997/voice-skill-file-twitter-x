import { NextResponse } from "next/server";
import type { LlmProviderConfig } from "@/lib/types";

export function jsonOk<T>(data: T, init?: ResponseInit) {
  return NextResponse.json(data, init);
}

export function jsonError(message: string, status = 400, details?: unknown) {
  return NextResponse.json({ error: message, details }, { status });
}

export function jsonErrorFromUnknown(error: unknown, fallbackMessage: string, status = 500) {
  const message = error instanceof Error && error.message ? error.message : fallbackMessage;
  return jsonError(message, status);
}

export function providerConfigFromBody(body: { providerConfig?: LlmProviderConfig }): LlmProviderConfig {
  const supplied = body.providerConfig ?? {};
  const contextWindowTokens = Number(supplied.contextWindowTokens);
  return {
    provider: supplied.provider,
    apiKey: supplied.apiKey,
    model: supplied.model,
    embeddingModel: supplied.embeddingModel,
    baseUrl: supplied.baseUrl,
    contextWindowTokens: Number.isFinite(contextWindowTokens) && contextWindowTokens > 0 ? contextWindowTokens : undefined,
  };
}

export function parseJsonField<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export function stringifyJsonField(value: unknown) {
  return JSON.stringify(value);
}
