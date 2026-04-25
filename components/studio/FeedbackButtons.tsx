"use client";

import Link from "next/link";
import { useState } from "react";
import { readApiJson } from "@/lib/http/readApiJson";
import { FEEDBACK_ACTIONS, NOTE_ONLY_FEEDBACK_LABEL } from "@/lib/voice/feedbackActions";

type FeedbackResult = {
  outcome: {
    title: string;
    description: string;
    primaryAction: string;
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
}: {
  generationId: string;
  brandId: string;
  onGenerateAnother: () => void;
}) {
  const [comment, setComment] = useState("");
  const [result, setResult] = useState<FeedbackResult | null>(null);
  const [error, setError] = useState("");
  const [loadingLabel, setLoadingLabel] = useState("");

  async function submit(label: string) {
    setError("");
    setResult(null);
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
          <span className="text-xs text-muted">Or choose one action below; your note will be attached to that action.</span>
        </div>
      </div>

      <div>
        <p className="text-sm font-medium text-ink">What should change next time?</p>
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
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={onGenerateAnother}
                className="rounded-ui bg-ink px-3 py-2 text-xs font-medium text-white"
              >
                {result.outcome.primaryAction}
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
