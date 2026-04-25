"use client";

import { useState } from "react";
import type { VoiceSkillFile } from "@/lib/types";

export function SkillFileEditor({ brandId, skillFile }: { brandId: string; skillFile: VoiceSkillFile }) {
  const [text, setText] = useState(JSON.stringify(skillFile, null, 2));
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function save() {
    setError("");
    setMessage("");
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      setError("Skill file JSON is invalid.");
      return;
    }

    setLoading(true);
    const response = await fetch(`/api/brands/${brandId}/skill-file`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ skillJson: parsed }),
    });
    const json = await response.json();
    setLoading(false);

    if (!response.ok) {
      setError(json.error || "Could not save skill file.");
      return;
    }

    setText(JSON.stringify(json.skillFile.skillJson, null, 2));
    setMessage(`Saved ${json.skillFile.version}.`);
  }

  return (
    <div className="space-y-4">
      <textarea
        value={text}
        onChange={(event) => setText(event.target.value)}
        className="min-h-[620px] w-full rounded-ui border border-line bg-white p-4 font-mono text-sm leading-6 text-ink"
        spellCheck={false}
      />
      <div className="flex items-center gap-3">
        <button onClick={save} disabled={loading} className="rounded-ui bg-ink px-4 py-2 text-sm font-medium text-white disabled:opacity-60">
          {loading ? "Saving..." : "Save new version"}
        </button>
        {message ? <span className="text-sm text-good">{message}</span> : null}
        {error ? <span className="text-sm text-weak">{error}</span> : null}
      </div>
    </div>
  );
}
