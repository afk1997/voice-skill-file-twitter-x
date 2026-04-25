"use client";

import { useState } from "react";
import { FEEDBACK_LABELS } from "@/lib/constants";

export function FeedbackButtons({ generationId }: { generationId: string }) {
  const [comment, setComment] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loadingLabel, setLoadingLabel] = useState("");

  async function submit(label: string) {
    setError("");
    setMessage("");
    setLoadingLabel(label);
    const response = await fetch(`/api/generations/${generationId}/feedback`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ label, comment }),
    });
    const json = await response.json();
    setLoadingLabel("");
    if (!response.ok) {
      setError(json.error || "Could not save feedback.");
      return;
    }
    setMessage(`Feedback saved. Skill file is now ${json.skillFile.version}.`);
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
      {message ? <p className="text-sm text-good">{message}</p> : null}
      {error ? <p className="text-sm text-weak">{error}</p> : null}
    </div>
  );
}
