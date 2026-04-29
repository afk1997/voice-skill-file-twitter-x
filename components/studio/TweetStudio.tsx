"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { readStoredProviderConfig } from "@/components/settings/ProviderSettingsForm";
import { FeedbackButtons } from "@/components/studio/FeedbackButtons";
import { TWEET_TYPES } from "@/lib/constants";
import { readApiJson } from "@/lib/http/readApiJson";
import { candidatePoolSize, providerModeForConfig } from "@/lib/llm/providerMode";
import type { EvaluationComponentScores, LlmProviderConfig, ProviderName, StyleDistanceMetadata } from "@/lib/types";
import type { SkillFileHealth } from "@/lib/voice/skillFileHealth";

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
    revisionNote?: string;
    componentScores?: EvaluationComponentScores;
    styleDistance?: StyleDistanceMetadata;
    provenance?: {
      skillFileVersion?: string;
      retrievalMode?: "hybrid" | "voice-only";
      selectedExamples?: string[];
      counterExamples?: string[];
    };
    retryCount?: number;
  } | null;
};

function scoreClass(score: number) {
  if (score >= 90) return "text-good";
  if (score >= 70) return "text-warn";
  return "text-weak";
}

export function TweetStudio({
  brandId,
  skillHealth,
  skillFileVersion,
}: {
  brandId: string;
  skillHealth: SkillFileHealth;
  skillFileVersion: string;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const contextRef = useRef<HTMLTextAreaElement>(null);
  const [context, setContext] = useState("");
  const [tweetType, setTweetType] = useState<(typeof TWEET_TYPES)[number]>("single tweet");
  const [variations, setVariations] = useState(5);
  const [notes, setNotes] = useState("");
  const [generations, setGenerations] = useState<Generation[]>([]);
  const [providerConfig, setProviderConfig] = useState<LlmProviderConfig>({});
  const [serverProvider, setServerProvider] = useState<ProviderName | undefined>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const mode = providerModeForConfig(providerConfig, { serverProvider });

  useEffect(() => {
    setProviderConfig(readStoredProviderConfig());
    fetch("/api/provider-status")
      .then((response) => readApiJson<{ error?: string; provider?: ProviderName }>(response))
      .then((status) => setServerProvider(status.provider))
      .catch(() => setServerProvider(undefined));
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
      <form ref={formRef} onSubmit={onSubmit} className="h-fit space-y-5 spool-plate p-5">
        <div className="spool-plate-soft p-3">
          <p className="text-xs font-semibold uppercase text-muted">Generation Mode</p>
          <p className="mt-1 text-sm font-medium text-ink">{mode.label}</p>
          <p className="mt-1 text-xs leading-5 text-muted">{mode.description}</p>
          {mode.label === "Setup Required" ? (
            <Link href="/settings" className="spool-button mt-2 text-xs">
              Configure provider
            </Link>
          ) : null}
        </div>

        <div className="spool-plate-soft p-3">
          <p className="text-xs font-semibold uppercase text-muted">Voice Evidence</p>
          <p className="mt-1 text-sm font-medium text-ink">
            {skillFileVersion} · {skillHealth.label}
          </p>
          <p className="mt-1 text-xs leading-5 text-muted">{skillHealth.description}</p>
          <p className="mt-2 text-xs text-muted">
            {skillHealth.corpusSampleCount.toLocaleString()} corpus samples / {skillHealth.usefulSampleCount.toLocaleString()} useful samples
          </p>
          {skillHealth.isStale || !skillHealth.corpusBacked ? (
            <Link href={`/brands/${brandId}/voice-report`} className="spool-button-secondary mt-2 text-xs">
              Refresh Skill File
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
            className="min-h-36 w-full spool-field px-3 py-2 text-sm"
            placeholder="What should the tweet be about?"
          />
        </label>

        <label className="block space-y-1">
          <span className="text-sm font-medium text-ink">Tweet type</span>
          <select value={tweetType} onChange={(event) => setTweetType(event.target.value as (typeof TWEET_TYPES)[number])} className="w-full spool-field px-3 py-2 text-sm">
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
            className="w-full spool-field px-3 py-2 text-sm"
          />
        </label>

        <label className="block space-y-1">
          <span className="text-sm font-medium text-ink">Optional notes</span>
          <textarea value={notes} onChange={(event) => setNotes(event.target.value)} className="min-h-24 w-full spool-field px-3 py-2 text-sm" />
        </label>

        {error ? <p className="text-sm text-weak">{error}</p> : null}

        <button type="submit" disabled={loading} className="spool-button disabled:opacity-60">
          {loading ? "Generating..." : `Generate top ${variations} tweets`}
        </button>
        <p className="text-xs leading-5 text-muted">
          The system will draft up to {candidatePoolSize(variations)} candidates internally, score them, and show the strongest {variations}.
        </p>
      </form>

      <section className="space-y-4">
        {generations.length === 0 ? (
          <div className="spool-plate p-5">
            <h2 className="font-semibold text-ink">Generated tweets will appear here</h2>
            <p className="mt-2 text-sm text-muted">Each draft is retrieved from real examples, scored, reranked, and ready for feedback.</p>
          </div>
        ) : (
          generations.map((generation) => (
            <article key={generation.id} className="space-y-4 spool-plate p-5">
              {generation.issuesJson?.revisedFromGenerationId ? (
                <p className="spool-stamp bg-good/10 text-good">Revised draft</p>
              ) : null}
              {generation.issuesJson?.revisionNote ? (
                <p className="rounded-ui border border-line bg-surface px-3 py-2 text-xs leading-5 text-muted">
                  Revision note: {generation.issuesJson.revisionNote}
                </p>
              ) : null}
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <p className="whitespace-pre-wrap text-base leading-7 text-ink">{generation.outputText}</p>
                <div className="shrink-0 border-[1.5px] border-ink bg-surface px-3 py-2 text-right shadow-stamp">
                  <p className={`text-xl font-semibold ${scoreClass(generation.score)}`}>{generation.score}</p>
                  <p className="text-xs text-muted">{generation.scoreLabel}</p>
                </div>
              </div>
              {generation.reason ? <p className="text-sm text-muted">{generation.reason}</p> : null}
              <div className="grid gap-3 md:grid-cols-2">
                {generation.issuesJson?.componentScores ? (
                  <div className="spool-plate-soft p-3">
                    <p className="text-xs font-semibold uppercase text-muted">Score breakdown</p>
                    <dl className="mt-2 grid grid-cols-2 gap-2 text-xs">
                      {Object.entries(generation.issuesJson.componentScores).map(([key, value]) => (
                        <div key={key} className="flex justify-between gap-2">
                          <dt className="text-muted">{key.replace(/([A-Z])/g, " $1")}</dt>
                          <dd className="font-medium text-ink">{value}</dd>
                        </div>
                      ))}
                    </dl>
                  </div>
                ) : null}
                {generation.issuesJson?.styleDistance ? (
                  <div className="spool-plate-soft p-3">
                    <p className="text-xs font-semibold uppercase text-muted">Style distance</p>
                    <p className="mt-1 text-sm font-semibold text-ink">{generation.issuesJson.styleDistance.score}/100</p>
                    <dl className="mt-2 grid grid-cols-2 gap-2 text-xs">
                      {Object.entries(generation.issuesJson.styleDistance.metrics).map(([key, value]) => (
                        <div key={key} className="flex justify-between gap-2">
                          <dt className="text-muted">{key.replace(/([A-Z])/g, " $1")}</dt>
                          <dd className="font-medium text-ink">{value}</dd>
                        </div>
                      ))}
                    </dl>
                    {generation.issuesJson.styleDistance.nearestExample ? (
                      <p className="mt-2 max-h-16 overflow-hidden text-xs leading-5 text-muted">
                        Nearest: {generation.issuesJson.styleDistance.nearestExample.text}
                      </p>
                    ) : null}
                  </div>
                ) : null}
              </div>
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
              {generation.issuesJson?.provenance?.selectedExamples?.length ? (
                <details className="spool-plate-soft p-3">
                  <summary className="cursor-pointer text-sm font-medium text-ink">
                    Evidence used
                    {generation.issuesJson.provenance.retrievalMode ? (
                      <span className="ml-2 text-xs text-muted">
                        {generation.issuesJson.provenance.retrievalMode === "hybrid" ? "semantic + voice rerank" : "voice rerank"}
                      </span>
                    ) : null}
                    {generation.issuesJson.retryCount ? <span className="ml-2 text-xs text-muted">retry {generation.issuesJson.retryCount}</span> : null}
                  </summary>
                  <div className="mt-3 space-y-2">
                    {generation.issuesJson.provenance.selectedExamples.slice(0, 4).map((example, index) => (
                      <p key={`${example}-${index}`} className="whitespace-pre-wrap rounded-ui bg-white p-2 text-xs leading-5 text-muted">
                        {example}
                      </p>
                    ))}
                  </div>
                </details>
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
