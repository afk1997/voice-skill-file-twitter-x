"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { readStoredProviderConfig } from "@/components/settings/ProviderSettingsForm";
import { readApiJson } from "@/lib/http/readApiJson";
import { providerModeForConfig } from "@/lib/llm/providerMode";
import type { LlmProviderConfig, ProviderName } from "@/lib/types";
import type { VoiceReport } from "@/lib/types";

function ToneSlider({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="flex justify-between text-xs text-muted">
        <span>{label}</span>
        <span>{value}</span>
      </div>
      <div className="mt-1 h-2 overflow-hidden rounded-full bg-line">
        <div className="h-full bg-accent" style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
      </div>
    </div>
  );
}

export function VoiceReportView({ report }: { report: VoiceReport }) {
  return (
    <div className="space-y-6">
      <section className="rounded-ui border border-line bg-white p-5">
        <h2 className="text-xl font-semibold text-ink">Summary</h2>
        <p className="mt-2 text-sm leading-6 text-muted">{report.summary}</p>
      </section>

      <section className="rounded-ui border border-line bg-white p-5">
        <h2 className="text-xl font-semibold text-ink">Tone sliders</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {Object.entries(report.toneSliders).map(([key, value]) => (
            <ToneSlider key={key} label={key.replace(/([A-Z])/g, " $1")} value={value} />
          ))}
        </div>
      </section>

      <section className="rounded-ui border border-line bg-white p-5">
        <h2 className="text-xl font-semibold text-ink">Linguistic mechanics</h2>
        <dl className="mt-4 grid gap-3 text-sm md:grid-cols-2">
          {Object.entries(report.linguisticMechanics).map(([key, value]) => (
            <div key={key}>
              <dt className="font-medium text-ink">{key.replace(/([A-Z])/g, " $1")}</dt>
              <dd className="text-muted">{String(value)}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        {[
          ["Hook patterns", report.hookPatterns],
          ["Ending patterns", report.endingPatterns],
          ["Preferred phrases", report.preferredPhrases],
          ["Avoided phrases", report.avoidedPhrases],
        ].map(([title, items]) => (
          <div key={title as string} className="rounded-ui border border-line bg-white p-5">
            <h2 className="text-lg font-semibold text-ink">{title as string}</h2>
            <ul className="mt-3 space-y-2 text-sm text-muted">
              {(items as string[]).map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        ))}
      </section>

      {report.ruleEvidence?.length ? (
        <section className="rounded-ui border border-line bg-white p-5">
          <h2 className="text-xl font-semibold text-ink">Evidence-backed rules</h2>
          <div className="mt-4 space-y-4">
            {report.ruleEvidence.map((item) => (
              <div key={item.rule} className="border-t border-line pt-4 first:border-t-0 first:pt-0">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold text-ink">{item.rule}</h3>
                  <span className="text-xs font-medium text-muted">{item.confidence}% confidence</span>
                </div>
                <div className="mt-3 space-y-2">
                  {item.evidence.map((evidence) => (
                    <div key={`${item.rule}-${evidence.quote}`} className="rounded-ui bg-panel p-3">
                      <p className="whitespace-pre-wrap text-sm leading-6 text-ink">{evidence.quote}</p>
                      <p className="mt-1 text-xs leading-5 text-muted">{evidence.reason}</p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section className="rounded-ui border border-line bg-white p-5">
        <h2 className="text-xl font-semibold text-ink">Example tweets</h2>
        <div className="mt-3 space-y-2">
          {report.exampleTweets.map((tweet, index) => (
            <p key={`${tweet}-${index}`} className="whitespace-pre-wrap rounded-ui bg-panel p-3 text-sm leading-6 text-ink">
              {tweet}
            </p>
          ))}
        </div>
      </section>
    </div>
  );
}

export function AnalyzeVoicePanel({ brandId, initialReport }: { brandId: string; initialReport: VoiceReport | null }) {
  const [report, setReport] = useState<VoiceReport | null>(initialReport);
  const [providerConfig, setProviderConfig] = useState<LlmProviderConfig>({});
  const [serverProvider, setServerProvider] = useState<ProviderName | undefined>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const mode = providerModeForConfig(providerConfig, { serverProvider });

  useEffect(() => {
    setProviderConfig(readStoredProviderConfig());
    fetch("/api/provider-status")
      .then((response) => readApiJson<{ error?: string; provider?: ProviderName }>(response))
      .then((status) => setServerProvider(status.provider))
      .catch(() => setServerProvider(undefined));
  }, []);

  async function analyze() {
    const latestProviderConfig = readStoredProviderConfig();
    setProviderConfig(latestProviderConfig);
    setLoading(true);
    setError("");
    const response = await fetch(`/api/brands/${brandId}/analyze`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ providerConfig: latestProviderConfig }),
    });
    const json = await readApiJson<{ error?: string; report?: VoiceReport }>(response);
    setLoading(false);
    if (!response.ok) {
      setError(json.error || "Could not analyze voice.");
      return;
    }
    if (json.report) setReport(json.report);
  }

  return (
    <div className="space-y-6">
      <div className="rounded-ui border border-line bg-panel p-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-ink">Voice analysis</h2>
            <p className="mt-1 text-sm text-muted">Analyze the best useful samples and create the first Voice Skill File if needed.</p>
            <p className="mt-2 inline-flex rounded-ui border border-line bg-white px-2 py-1 text-xs font-medium text-muted">
              {mode.label}: {mode.description}
            </p>
          </div>
          <button onClick={analyze} disabled={loading} className="rounded-ui bg-ink px-4 py-2 text-sm font-medium text-white disabled:opacity-60">
            {loading ? "Analyzing..." : report ? "Re-analyze voice" : "Analyze voice"}
          </button>
        </div>
        {error ? <p className="mt-3 text-sm text-weak">{error}</p> : null}
      </div>
      {report ? <VoiceReportView report={report} /> : <p className="text-sm text-muted">No report yet.</p>}
      {report ? (
        <div className="flex flex-wrap gap-3 rounded-ui border border-line bg-white p-4">
          <Link href={`/brands/${brandId}/skill-file`} className="rounded-ui bg-ink px-4 py-2 text-sm font-medium text-white">
            Review Skill File
          </Link>
          <Link href={`/brands/${brandId}/studio`} className="rounded-ui border border-line px-4 py-2 text-sm font-medium text-ink hover:border-ink">
            Generate Tweets
          </Link>
        </div>
      ) : null}
    </div>
  );
}
