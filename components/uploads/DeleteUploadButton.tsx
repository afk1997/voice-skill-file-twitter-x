"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { readApiJson } from "@/lib/http/readApiJson";

export function DeleteUploadButton({ brandId, uploadId, fileName }: { brandId: string; uploadId: string; fileName: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function onDelete() {
    const confirmed = window.confirm(`Delete parsed tweets from ${fileName}?`);
    if (!confirmed) return;

    setLoading(true);
    setError("");
    const response = await fetch(`/api/brands/${brandId}/uploads/${uploadId}`, { method: "DELETE" });
    const json = await readApiJson(response);
    setLoading(false);

    if (!response.ok) {
      setError(json.error || "Could not delete upload.");
      return;
    }

    router.refresh();
  }

  return (
    <div className="space-y-1">
      <button
        type="button"
        onClick={onDelete}
        disabled={loading}
        className="rounded-ui border border-line px-3 py-1.5 text-xs font-medium text-weak hover:border-weak disabled:opacity-60"
      >
        {loading ? "Deleting..." : "Delete"}
      </button>
      {error ? <p className="max-w-40 text-xs text-weak">{error}</p> : null}
    </div>
  );
}
