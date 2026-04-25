"use client";

import { useState } from "react";
import type { VoiceSkillFile } from "@/lib/types";

export function SkillFileEditor({ brandId, skillFile }: { brandId: string; skillFile: VoiceSkillFile }) {
  const [text, setText] = useState(JSON.stringify(skillFile, null, 2));
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const rules = skillFile.rules ?? [];
  const retrievalHints = skillFile.retrievalHints;
  const approvedCount = skillFile.exampleLibrary.approvedGenerated.length;
  const rejectedCount = skillFile.exampleLibrary.rejectedGenerated.length;

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
      <section className="space-y-4 rounded-ui border border-line bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">Voice Skill File</p>
            <h2 className="mt-1 text-xl font-semibold text-ink">{skillFile.brandName}</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">{skillFile.voiceSummary}</p>
          </div>
          <div className="rounded-ui border border-line px-3 py-2 text-sm text-muted">
            {skillFile.version}
            {skillFile.schemaVersion ? <span className="ml-2 text-xs">schema {skillFile.schemaVersion}</span> : null}
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-ui border border-line bg-surface p-3">
            <p className="text-xs font-medium uppercase text-muted">Strongest Rules</p>
            <ul className="mt-2 space-y-2 text-sm text-ink">
              {rules.slice(0, 4).map((rule) => (
                <li key={rule.id}>{rule.rule}</li>
              ))}
              {rules.length === 0 ? <li>No structured rules yet.</li> : null}
            </ul>
          </div>
          <div className="rounded-ui border border-line bg-surface p-3">
            <p className="text-xs font-medium uppercase text-muted">Retrieval Hints</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {(retrievalHints?.preferredVocabulary ?? skillFile.preferredPhrases).slice(0, 10).map((phrase) => (
                <span key={phrase} className="rounded-ui bg-white px-2 py-1 text-xs text-ink">
                  {phrase}
                </span>
              ))}
            </div>
          </div>
          <div className="rounded-ui border border-line bg-surface p-3">
            <p className="text-xs font-medium uppercase text-muted">Learning Library</p>
            <dl className="mt-2 grid grid-cols-2 gap-2 text-sm">
              <div>
                <dt className="text-muted">Approved</dt>
                <dd className="font-semibold text-ink">{approvedCount}</dd>
              </div>
              <div>
                <dt className="text-muted">Rejected</dt>
                <dd className="font-semibold text-ink">{rejectedCount}</dd>
              </div>
              <div>
                <dt className="text-muted">On-brand</dt>
                <dd className="font-semibold text-ink">{skillFile.exampleLibrary.onBrand.length}</dd>
              </div>
              <div>
                <dt className="text-muted">Banned</dt>
                <dd className="font-semibold text-ink">{skillFile.avoidedPhrases.length}</dd>
              </div>
            </dl>
          </div>
        </div>
      </section>

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
