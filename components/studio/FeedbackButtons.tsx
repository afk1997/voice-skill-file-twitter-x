"use client";

import Link from "next/link";
import { useState } from "react";
import { readStoredProviderConfig } from "@/components/settings/ProviderSettingsForm";
import { readApiJson } from "@/lib/http/readApiJson";
import { FEEDBACK_ACTIONS, NOTE_ONLY_FEEDBACK_LABEL, PRIMARY_FEEDBACK_ACTIONS } from "@/lib/voice/feedbackActions";

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

type FeedbackResult = {
  outcome: {
    title: string;
    description: string;
    primaryAction: string;
  };
  changes: {
    addedRules: string[];
    avoidedPhrases: string[];
    approvedExamples: string[];
    rejectedExamples: string[];
  };
  skillFile: {
    brandId: string;
    version: string;
  };
};

export function FeedbackButtons({
  generationId,
  brandId,
  onGenerateAnother,
  onRevisionCreated,
}: {
  generationId: string;
  brandId: string;
  onGenerateAnother: () => void;
  onRevisionCreated: (generation: Generation, revisedFromGenerationId: string) => void;
}) {
  const [comment, setComment] = useState("");
  const [result, setResult] = useState<FeedbackResult | null>(null);
  const [revisionMessage, setRevisionMessage] = useState("");
  const [error, setError] = useState("");
  const [loadingLabel, setLoadingLabel] = useState("");
  const [revisionLoading, setRevisionLoading] = useState(false);

  async function submit(label: string) {
    setError("");
    setResult(null);
    setRevisionMessage("");
    setLoadingLabel(label);
    const response = await fetch(`/api/generations/${generationId}/feedback`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ label, comment }),
    });
    const json = await readApiJson<{ error?: string } & FeedbackResult>(response);
    setLoadingLabel("");
    if (!response.ok) {
      setError(json.error || "Could not save feedback.");
      return;
    }
    setResult(json);
    setComment("");
  }

  async function reviseDraft() {
    setError("");
    setRevisionMessage("");
    setRevisionLoading(true);
    const response = await fetch(`/api/generations/${generationId}/revise`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ providerConfig: readStoredProviderConfig() }),
    });
    const json = await readApiJson<{ error?: string; generation?: Generation }>(response);
    setRevisionLoading(false);
    if (!response.ok || !json.generation) {
      setError(json.error || "Could not apply the feedback to this draft.");
      return;
    }
    onRevisionCreated(json.generation, generationId);
    setRevisionMessage("Revised draft added below this one.");
  }

  const canRevise = Boolean(result && result.outcome.title !== "Approved example saved");
  const changedItems = result
    ? [
        ...result.changes.addedRules.map((rule) => `Added rule: ${rule}`),
        ...result.changes.avoidedPhrases.map((phrase) => `Avoid now: ${phrase}`),
        ...result.changes.approvedExamples.map(() => "Saved this draft as an approved example."),
        ...result.changes.rejectedExamples.map(() => "Saved this draft as a rejected counterexample."),
      ]
    : [];

  return (
    <div className="space-y-4 border-t border-line pt-4">
      <div className="space-y-2">
        <label className="block text-sm font-medium text-ink" htmlFor={`feedback-note-${generationId}`}>
          Add a note for the Skill File
        </label>
        <textarea
          id={`feedback-note-${generationId}`}
          value={comment}
          onChange={(event) => setComment(event.target.value)}
          className="min-h-20 w-full rounded-ui border border-line px-3 py-2 text-sm"
          placeholder="Example: Less emoji, mention LPs, replace [link] with the app URL, avoid this phrase..."
        />
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => submit(NOTE_ONLY_FEEDBACK_LABEL)}
            disabled={Boolean(loadingLabel) || !comment.trim()}
            className="rounded-ui bg-ink px-3 py-2 text-xs font-medium text-white disabled:opacity-40"
          >
            {loadingLabel === NOTE_ONLY_FEEDBACK_LABEL ? "Saving note..." : "Save note to Skill File"}
          </button>
          <span className="text-xs text-muted">This only saves the note. To reject the draft, use Reject draft below.</span>
        </div>
      </div>

      <div>
        <p className="text-sm font-medium text-ink">Decide what happens to this draft</p>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {PRIMARY_FEEDBACK_ACTIONS.map((action) => (
            <button
              key={action.label}
              type="button"
              onClick={() => submit(action.label)}
              disabled={Boolean(loadingLabel)}
              className="rounded-ui border border-line bg-white px-3 py-2 text-left hover:border-ink disabled:opacity-60"
            >
              <span className="block text-sm font-semibold text-ink">{loadingLabel === action.label ? "Saving..." : action.title}</span>
              <span className="mt-1 block text-xs leading-5 text-muted">{action.description}</span>
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="text-sm font-medium text-ink">Or request a specific revision</p>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {FEEDBACK_ACTIONS.map((action) => (
            <button
              key={action.label}
              type="button"
              onClick={() => submit(action.label)}
              disabled={Boolean(loadingLabel)}
              className="rounded-ui border border-line bg-white px-3 py-2 text-left hover:border-ink disabled:opacity-60"
            >
              <span className="block text-sm font-medium text-ink">{loadingLabel === action.label ? "Saving..." : action.title}</span>
              <span className="mt-1 block text-xs leading-5 text-muted">{action.description}</span>
            </button>
          ))}
        </div>
      </div>
      {result ? (
        <div className="rounded-ui border border-line bg-panel p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-sm font-semibold text-ink">{result.outcome.title}</p>
              <p className="mt-1 text-sm leading-6 text-muted">
                {result.outcome.description} Skill file is now {result.skillFile.version}.
              </p>
              {changedItems.length ? (
                <div className="mt-3">
                  <p className="text-xs font-semibold uppercase text-muted">What changed in the Skill File</p>
                  <ul className="mt-2 space-y-1 text-sm leading-6 text-muted">
                    {changedItems.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {revisionMessage ? <p className="mt-3 text-sm font-medium text-good">{revisionMessage}</p> : null}
            </div>
            <div className="flex flex-wrap gap-2">
              {canRevise ? (
                <button
                  type="button"
                  onClick={reviseDraft}
                  disabled={revisionLoading}
                  className="rounded-ui bg-ink px-3 py-2 text-xs font-medium text-white disabled:opacity-60"
                >
                  {revisionLoading ? "Applying fixes..." : "Apply fixes to this draft"}
                </button>
              ) : null}
              <button type="button" onClick={onGenerateAnother} className="rounded-ui border border-line bg-white px-3 py-2 text-xs font-medium text-ink hover:border-ink">
                Generate fresh batch
              </button>
              <Link
                href={`/brands/${result.skillFile.brandId || brandId}/skill-file`}
                className="rounded-ui border border-line bg-white px-3 py-2 text-xs font-medium text-ink hover:border-ink"
              >
                Review skill file
              </Link>
              <Link
                href={`/brands/${result.skillFile.brandId || brandId}`}
                className="rounded-ui border border-line bg-white px-3 py-2 text-xs font-medium text-ink hover:border-ink"
              >
                Brand dashboard
              </Link>
            </div>
          </div>
        </div>
      ) : null}
      {error ? <p className="text-sm text-weak">{error}</p> : null}
    </div>
  );
}
