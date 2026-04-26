"use client";

import Link from "next/link";
import { useState } from "react";
import { readStoredProviderConfig } from "@/components/settings/ProviderSettingsForm";
import { readApiJson } from "@/lib/http/readApiJson";
import { FEEDBACK_ACTIONS, NOTE_ONLY_FEEDBACK_LABEL, PRIMARY_FEEDBACK_ACTIONS, REJECT_FEEDBACK_LABEL } from "@/lib/voice/feedbackActions";

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
  const [selectedReason, setSelectedReason] = useState<string>(NOTE_ONLY_FEEDBACK_LABEL);
  const [result, setResult] = useState<FeedbackResult | null>(null);
  const [revisionMessage, setRevisionMessage] = useState("");
  const [error, setError] = useState("");
  const [loadingLabel, setLoadingLabel] = useState("");
  const [revisionLoading, setRevisionLoading] = useState(false);

  async function submit(label: string, options: { reviseAfter?: boolean } = {}) {
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
    if (options.reviseAfter) {
      await reviseDraft();
    }
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

  const canRevise = Boolean(result && result.outcome.title !== "Approved example saved" && !revisionMessage);
  const canSaveAndRevise = Boolean(comment.trim() || selectedReason !== NOTE_ONLY_FEEDBACK_LABEL);
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
      <div className="grid gap-3 md:grid-cols-[1fr_220px]">
        <label className="block space-y-2 text-sm font-medium text-ink" htmlFor={`feedback-note-${generationId}`}>
          <span>What should change?</span>
          <textarea
            id={`feedback-note-${generationId}`}
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            className="min-h-20 w-full rounded-ui border border-line px-3 py-2 text-sm font-normal"
            placeholder="Example: no em dashes, less hype, mention LPs, keep the idea but make it sharper..."
          />
        </label>
        <label className="block space-y-2 text-sm font-medium text-ink" htmlFor={`feedback-reason-${generationId}`}>
          <span>Reason</span>
          <select
            id={`feedback-reason-${generationId}`}
            value={selectedReason}
            onChange={(event) => setSelectedReason(event.target.value)}
            className="w-full rounded-ui border border-line px-3 py-2 text-sm font-normal"
          >
            <option value={NOTE_ONLY_FEEDBACK_LABEL}>Use note only</option>
            {FEEDBACK_ACTIONS.map((action) => (
              <option key={action.label} value={action.label}>
                {action.title}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => submit(selectedReason, { reviseAfter: true })}
          disabled={Boolean(loadingLabel) || revisionLoading || !canSaveAndRevise}
          className="rounded-ui bg-ink px-3 py-2 text-sm font-medium text-white disabled:opacity-40"
        >
          {loadingLabel || revisionLoading ? "Applying feedback..." : "Save feedback & revise draft"}
        </button>
        {PRIMARY_FEEDBACK_ACTIONS.map((action) => (
          <button
            key={action.label}
            type="button"
            onClick={() => submit(action.label)}
            disabled={Boolean(loadingLabel) || revisionLoading}
            className="rounded-ui border border-line bg-white px-3 py-2 text-sm font-medium text-ink hover:border-ink disabled:opacity-60"
          >
            {loadingLabel === action.label ? "Saving..." : action.label === REJECT_FEEDBACK_LABEL ? "Reject draft" : "Approve"}
          </button>
        ))}
        <span className="text-xs leading-5 text-muted">Feedback edits the Skill File first, then revises this draft with the updated rules.</span>
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
            </div>
          </div>
        </div>
      ) : null}
      {error ? <p className="text-sm text-weak">{error}</p> : null}
    </div>
  );
}
