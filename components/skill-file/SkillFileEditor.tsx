"use client";

import { useState } from "react";
import type { VoiceSkillFile } from "@/lib/types";
import type { SkillFileDiff } from "@/lib/voice/skillFileDiff";

export function SkillFileEditor({ brandId, skillFile, versionDiff }: { brandId: string; skillFile: VoiceSkillFile; versionDiff?: SkillFileDiff | null }) {
  const [text, setText] = useState(JSON.stringify(skillFile, null, 2));
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const rules = skillFile.rules ?? [];
  const retrievalHints = skillFile.retrievalHints;
  const approvedCount = skillFile.exampleLibrary.approvedGenerated.length;
  const rejectedCount = skillFile.exampleLibrary.rejectedGenerated.length;
  const voiceKernel = skillFile.voiceKernel;

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

        {voiceKernel ? (
          <div className="rounded-ui border border-line bg-surface p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-medium uppercase text-muted">Voice Kernel</p>
                <h3 className="mt-1 text-base font-semibold text-ink">
                  {voiceKernel.length.band} rhythm · {voiceKernel.sampleCount.toLocaleString()} samples
                </h3>
              </div>
              <div className="text-right text-sm text-muted">
                <p>{voiceKernel.length.idealRange[0]}-{voiceKernel.length.idealRange[1]} chars</p>
                <p>{voiceKernel.formatting.lineBreakRate}% line breaks</p>
              </div>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <div>
                <p className="text-xs font-medium uppercase text-muted">Format</p>
                <dl className="mt-2 space-y-1 text-sm">
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted">Emoji</dt>
                    <dd className="font-medium text-ink">{voiceKernel.formatting.emojiFrequency}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted">Hashtags</dt>
                    <dd className="font-medium text-ink">{voiceKernel.formatting.hashtagRate}%</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted">Mentions</dt>
                    <dd className="font-medium text-ink">{voiceKernel.formatting.mentionRate}%</dd>
                  </div>
                </dl>
              </div>
              <div>
                <p className="text-xs font-medium uppercase text-muted">Openers</p>
                <ul className="mt-2 space-y-1 text-sm text-ink">
                  {voiceKernel.rhythm.openingPatterns.slice(0, 3).map((pattern) => (
                    <li key={pattern}>{pattern}</li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="text-xs font-medium uppercase text-muted">Model-default bans</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {voiceKernel.vocabulary.forbiddenModelDefaults.slice(0, 8).map((phrase) => (
                    <span key={phrase} className="rounded-ui bg-white px-2 py-1 text-xs text-ink">
                      {phrase}
                    </span>
                  ))}
                </div>
              </div>
            </div>
            <ul className="mt-4 space-y-1 border-t border-line pt-3 text-sm text-muted">
              {voiceKernel.generationRules.slice(0, 4).map((rule) => (
                <li key={rule}>{rule}</li>
              ))}
            </ul>
          </div>
        ) : null}

        {versionDiff ? (
          <div className="rounded-ui border border-line bg-surface p-4">
            <p className="text-xs font-medium uppercase text-muted">Version Diff</p>
            <h3 className="mt-1 text-base font-semibold text-ink">{versionDiff.title}</h3>
            {versionDiff.items.length ? (
              <ul className="mt-3 space-y-1 text-sm leading-6 text-muted">
                {versionDiff.items.slice(0, 12).map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-muted">No meaningful voice changes detected between these two versions.</p>
            )}
          </div>
        ) : null}
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
