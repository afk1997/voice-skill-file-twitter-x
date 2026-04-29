"use client";

import Link from "next/link";
import { useState } from "react";
import { readApiJson } from "@/lib/http/readApiJson";

type UploadSummary = {
  totalFound: number;
  imported: number;
  usefulItems: number;
  excludedItems: number;
  counts: Record<string, number>;
  usefulPreview: string[];
};

export function UploadForm({ brandId }: { brandId: string }) {
  const [summary, setSummary] = useState<UploadSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSummary(null);
    setLoading(true);
    const formData = new FormData(event.currentTarget);
    const response = await fetch(`/api/brands/${brandId}/uploads`, { method: "POST", body: formData });
    const json = await readApiJson<{ error?: string; summary?: UploadSummary }>(response);
    setLoading(false);
    if (!response.ok) {
      setError(json.error || "Could not upload file.");
      return;
    }
    setSummary(json.summary || null);
  }

  return (
    <div className="space-y-5">
      <form onSubmit={onSubmit} className="spool-plate p-5">
        <label className="block space-y-2">
          <span className="text-sm font-medium text-ink">Archive or sample file</span>
          <input
            type="file"
            name="file"
            required
            accept=".zip,.js,.json,.csv,.txt"
            className="spool-field block w-full px-3 py-2 text-sm"
          />
        </label>
        <p className="mt-2 text-sm text-muted">Supports Twitter/X archive ZIPs plus `.js`, `.json`, `.csv`, and `.txt` tweet samples.</p>
        {error ? <p className="mt-3 text-sm text-weak">{error}</p> : null}
        <button type="submit" disabled={loading} className="spool-button mt-4 disabled:opacity-60">
          {loading ? "Parsing..." : "Upload and parse"}
        </button>
      </form>

      {summary ? (
        <section className="space-y-5 spool-plate p-5">
          <div>
            <h2 className="text-xl font-semibold text-ink">Upload summary</h2>
            <p className="mt-2 text-sm text-muted">
              Found {summary.totalFound.toLocaleString()} tweets. Imported {summary.imported.toLocaleString()}.{" "}
              {summary.usefulItems.toLocaleString()} are useful for voice learning. {summary.excludedItems.toLocaleString()} were excluded.
            </p>
          </div>

          <div className="grid gap-2 md:grid-cols-4">
            {Object.entries(summary.counts).map(([classification, count]) => (
              <div key={classification} className="spool-plate-soft p-3">
                <p className="text-xs uppercase text-muted">{classification.replaceAll("_", " ")}</p>
                <p className="mt-1 text-xl font-semibold text-ink">{count}</p>
              </div>
            ))}
          </div>

          <div>
            <h3 className="font-semibold text-ink">First useful samples</h3>
            {summary.usefulPreview.length === 0 ? (
              <p className="mt-2 text-sm text-muted">No useful samples found. Try uploading more representative writing.</p>
            ) : (
              <ol className="mt-3 space-y-2">
                {summary.usefulPreview.map((tweet, index) => (
                  <li key={`${tweet}-${index}`} className="spool-plate-soft whitespace-pre-wrap p-3 text-sm leading-6 text-ink">
                    {tweet}
                  </li>
                ))}
              </ol>
            )}
          </div>

          <div className="flex flex-col gap-3 border-t border-line pt-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="font-semibold text-ink">Next step: analyze the brand voice</h3>
              <p className="mt-1 text-sm text-muted">Turn these useful samples into a reusable Skill File.</p>
            </div>
            <Link href={`/brands/${brandId}/voice-report`} className="spool-button text-center">
              Analyze voice
            </Link>
          </div>
        </section>
      ) : null}
    </div>
  );
}
