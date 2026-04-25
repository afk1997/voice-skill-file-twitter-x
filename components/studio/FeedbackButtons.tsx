"use client";

import Link from "next/link";
import { useState } from "react";
import { FEEDBACK_LABELS } from "@/lib/constants";
import { readApiJson } from "@/lib/http/readApiJson";

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
    <div className="space-y-3 border-t border-line pt-4">
      <textarea
        value={comment}
        onChange={(event) => setComment(event.target.value)}
        className="min-h-16 w-full rounded-ui border border-line px-3 py-2 text-sm"
        placeholder="Optional note"
      />
      <div className="flex flex-wrap gap-2">
        {FEEDBACK_LABELS.map((label) => (
          <button
            key={label}
            type="button"
            onClick={() => submit(label)}
            disabled={Boolean(loadingLabel)}
            className="rounded-ui border border-line bg-white px-3 py-1.5 text-xs font-medium text-ink hover:border-ink disabled:opacity-60"
          >
            {loadingLabel === label ? "Saving..." : label}
          </button>
        ))}
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
