"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { readStoredProviderConfig } from "@/components/settings/ProviderSettingsForm";
import { FeedbackButtons } from "@/components/studio/FeedbackButtons";
import { TWEET_TYPES } from "@/lib/constants";
import { readApiJson } from "@/lib/http/readApiJson";
import { candidatePoolSize, providerModeForConfig } from "@/lib/llm/providerMode";
import type { LlmProviderConfig } from "@/lib/types";

type Generation = {
  id: string;
  outputText: string;
  score: number;
  scoreLabel: string;
  reason?: string | null;
  issuesJson?: {
    issues?: string[];
    suggestedRevisionDirection?: string;
    revisedFromGenerationId?: string;
  } | null;
};

function scoreClass(score: number) {
  if (score >= 90) return "text-good";
  if (score >= 70) return "text-warn";
  return "text-weak";
}

export function TweetStudio({ brandId }: { brandId: string }) {
  const formRef = useRef<HTMLFormElement>(null);
  const contextRef = useRef<HTMLTextAreaElement>(null);
  const [context, setContext] = useState("");
  const [tweetType, setTweetType] = useState<(typeof TWEET_TYPES)[number]>("single tweet");
  const [variations, setVariations] = useState(5);
  const [notes, setNotes] = useState("");
  const [generations, setGenerations] = useState<Generation[]>([]);
  const [providerConfig, setProviderConfig] = useState<LlmProviderConfig>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const mode = providerModeForConfig(providerConfig);

  useEffect(() => {
    setProviderConfig(readStoredProviderConfig());
  }, []);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const latestProviderConfig = readStoredProviderConfig();
    setProviderConfig(latestProviderConfig);
    setError("");
    setGenerations([]);
    setLoading(true);
    const response = await fetch(`/api/brands/${brandId}/generate`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        context,
        tweetType,
        variations,
        notes,
        providerConfig: latestProviderConfig,
      }),
    });
    const json = await readApiJson<{ error?: string; generations?: Generation[] }>(response);
    setLoading(false);
    if (!response.ok) {
      setError(json.error || "Could not generate tweets.");
      return;
    }
    setGenerations(json.generations || []);
  }

  function prepareNextBatch() {
    setGenerations([]);
    setError("");
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    window.setTimeout(() => contextRef.current?.focus(), 150);
  }

  function addRevisedGeneration(revised: Generation, revisedFromGenerationId: string) {
    setGenerations((current) => {
      const next: Generation[] = [];
      let inserted = false;
      for (const generation of current) {
        next.push(generation);
        if (generation.id === revisedFromGenerationId) {
          next.push(revised);
          inserted = true;
        }
      }
      return inserted ? next : [revised, ...current];
    });
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[380px_1fr]">
      <form ref={formRef} onSubmit={onSubmit} className="h-fit space-y-5 rounded-ui border border-line bg-white p-5">
        <div className="rounded-ui border border-line bg-surface p-3">
          <p className="text-xs font-semibold uppercase text-muted">Generation Mode</p>
          <p className="mt-1 text-sm font-medium text-ink">{mode.label}</p>
          <p className="mt-1 text-xs leading-5 text-muted">{mode.description}</p>
          {mode.label === "Setup Required" ? (
            <Link href="/settings" className="mt-2 inline-flex rounded-ui bg-ink px-3 py-2 text-xs font-medium text-white">
              Configure provider
            </Link>
          ) : null}
        </div>

        <label className="block space-y-1">
          <span className="text-sm font-medium text-ink">Raw idea or context</span>
          <textarea
            ref={contextRef}
            required
            value={context}
            onChange={(event) => setContext(event.target.value)}
            className="min-h-36 w-full rounded-ui border border-line px-3 py-2 text-sm"
            placeholder="What should the tweet be about?"
          />
        </label>

        <label className="block space-y-1">
          <span className="text-sm font-medium text-ink">Tweet type</span>
          <select value={tweetType} onChange={(event) => setTweetType(event.target.value as (typeof TWEET_TYPES)[number])} className="w-full rounded-ui border border-line px-3 py-2 text-sm">
            {TWEET_TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </label>

        <label className="block space-y-1">
          <span className="text-sm font-medium text-ink">Variations</span>
          <input
            type="number"
            min={1}
            max={10}
            value={variations}
            onChange={(event) => setVariations(Number(event.target.value))}
            className="w-full rounded-ui border border-line px-3 py-2 text-sm"
          />
        </label>

        <label className="block space-y-1">
          <span className="text-sm font-medium text-ink">Optional notes</span>
          <textarea value={notes} onChange={(event) => setNotes(event.target.value)} className="min-h-24 w-full rounded-ui border border-line px-3 py-2 text-sm" />
        </label>

        {error ? <p className="text-sm text-weak">{error}</p> : null}

        <button type="submit" disabled={loading} className="rounded-ui bg-ink px-4 py-2 text-sm font-medium text-white disabled:opacity-60">
          {loading ? "Generating..." : `Generate top ${variations} tweets`}
        </button>
        <p className="text-xs leading-5 text-muted">
          The system will draft up to {candidatePoolSize(variations)} candidates internally, score them, and show the strongest {variations}.
        </p>
      </form>

      <section className="space-y-4">
        {generations.length === 0 ? (
          <div className="rounded-ui border border-line bg-panel p-5">
            <h2 className="font-semibold text-ink">Generated tweets will appear here</h2>
            <p className="mt-2 text-sm text-muted">Each draft is retrieved from real examples, scored, reranked, and ready for feedback.</p>
          </div>
        ) : (
          generations.map((generation) => (
            <article key={generation.id} className="space-y-4 rounded-ui border border-line bg-white p-5">
              {generation.issuesJson?.revisedFromGenerationId ? (
                <p className="rounded-ui bg-good/10 px-3 py-2 text-xs font-semibold uppercase text-good">Revised with latest Skill File feedback</p>
              ) : null}
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <p className="whitespace-pre-wrap text-base leading-7 text-ink">{generation.outputText}</p>
                <div className="shrink-0 rounded-ui bg-panel px-3 py-2 text-right">
                  <p className={`text-xl font-semibold ${scoreClass(generation.score)}`}>{generation.score}</p>
                  <p className="text-xs text-muted">{generation.scoreLabel}</p>
                </div>
              </div>
              {generation.reason ? <p className="text-sm text-muted">{generation.reason}</p> : null}
              {generation.issuesJson?.issues?.length ? (
                <div>
                  <p className="text-sm font-medium text-ink">Detected issues</p>
                  <ul className="mt-1 space-y-1 text-sm text-muted">
                    {generation.issuesJson.issues.map((issue) => (
                      <li key={issue}>{issue}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {generation.issuesJson?.suggestedRevisionDirection ? (
                <p className="text-sm text-muted">Revision direction: {generation.issuesJson.suggestedRevisionDirection}</p>
              ) : null}
              <FeedbackButtons
                generationId={generation.id}
                brandId={brandId}
                onGenerateAnother={prepareNextBatch}
                onRevisionCreated={addRevisedGeneration}
              />
            </article>
          ))
        )}
      </section>
    </div>
  );
}
