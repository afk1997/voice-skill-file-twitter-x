"use client";

import { useCallback, useEffect, useState } from "react";
import { readApiJson } from "@/lib/http/readApiJson";

type CodexStatus = {
  available: boolean;
  connected: boolean;
  account: {
    type: string;
    email?: string;
    planType?: string | null;
  } | null;
  rateLimits?: {
    limitId?: string;
    usedPercent?: number;
    windowDurationMins?: number;
    resetsAt?: number;
    rateLimitReachedType?: string | null;
  } | null;
  error?: string;
};

type LoginState = {
  loginId: string;
  verificationUrl: string;
  userCode: string;
};

function formatReset(seconds?: number) {
  if (!seconds) return "";
  return new Date(seconds * 1000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

export function CodexLocalPanel() {
  const [status, setStatus] = useState<CodexStatus | null>(null);
  const [login, setLogin] = useState<LoginState | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const refreshStatus = useCallback(async () => {
    const response = await fetch("/api/codex/status", { cache: "no-store" });
    const json = await readApiJson<CodexStatus & { error?: string }>(response);
    setStatus(json);
    if (json.connected) setLogin(null);
  }, []);

  const refreshWithError = useCallback(async () => {
    setError("");
    try {
      await refreshStatus();
    } catch (nextError) {
      setError(errorMessage(nextError, "Could not read Codex Local status."));
    }
  }, [refreshStatus]);

  useEffect(() => {
    refreshWithError();
  }, [refreshWithError]);

  useEffect(() => {
    if (!login) return;
    const id = window.setInterval(() => {
      refreshStatus().catch(() => undefined);
    }, 3000);
    return () => window.clearInterval(id);
  }, [login, refreshStatus]);

  async function startLogin() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/codex/login/start", { method: "POST" });
      const json = await readApiJson<LoginState & { error?: string }>(response);
      if (!response.ok || json.error) throw new Error(json.error || "Could not start Codex Local login.");
      if (!json.loginId || !json.verificationUrl || !json.userCode) throw new Error("Codex Local returned an incomplete login response.");
      setLogin(json);
      await refreshStatus();
    } catch (nextError) {
      setError(errorMessage(nextError, "Could not start Codex Local login."));
    } finally {
      setLoading(false);
    }
  }

  async function cancelLogin() {
    if (!login) return;
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/codex/login/cancel", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ loginId: login.loginId }),
      });
      const json = await readApiJson<{ error?: string }>(response);
      if (!response.ok || json.error) throw new Error(json.error || "Could not cancel Codex Local login.");
      setLogin(null);
      await refreshStatus();
    } catch (nextError) {
      setError(errorMessage(nextError, "Could not cancel Codex Local login."));
    } finally {
      setLoading(false);
    }
  }

  async function logout() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/codex/logout", { method: "POST" });
      const json = await readApiJson<{ error?: string }>(response);
      if (!response.ok || json.error) throw new Error(json.error || "Could not log out of Codex Local.");
      setLogin(null);
      await refreshStatus();
    } catch (nextError) {
      setError(errorMessage(nextError, "Could not log out of Codex Local."));
    } finally {
      setLoading(false);
    }
  }

  const rateLimit = status?.rateLimits;

  return (
    <section className="space-y-4 border-t-[1.5px] border-line pt-4">
      <div>
        <p className="text-sm font-semibold text-ink">Codex Local</p>
        <p className="mt-1 text-sm text-muted">Uses your local Codex ChatGPT sign-in. Nothing here stores ChatGPT tokens in Spool.</p>
      </div>

      {status ? (
        <div className="space-y-2 text-sm text-muted">
          <p>
            Status: <span className="font-semibold text-ink">{status.connected ? "Connected" : status.available ? "Ready to connect" : "Unavailable"}</span>
          </p>
          {status.account?.email ? <p>Account: {status.account.email}</p> : null}
          {status.account?.planType ? <p>Plan: {status.account.planType}</p> : null}
          {rateLimit?.usedPercent !== undefined ? (
            <p>
              Codex usage: {rateLimit.usedPercent}% used{rateLimit.resetsAt ? `, resets around ${formatReset(rateLimit.resetsAt)}` : ""}
            </p>
          ) : null}
          {status.error ? <p className="text-weak">{status.error}</p> : null}
        </div>
      ) : (
        <p className="text-sm text-muted">Checking Codex Local...</p>
      )}

      {login ? (
        <div className="space-y-3 border-[1.5px] border-ink bg-light p-3">
          <p className="text-sm font-semibold text-ink">Finish sign-in</p>
          <p className="text-sm text-muted">Open the verification page and enter this code.</p>
          <a href={login.verificationUrl} target="_blank" rel="noreferrer" className="spool-button-secondary">
            Open verification page
          </a>
          <p className="font-mono text-lg font-semibold text-ink">{login.userCode}</p>
        </div>
      ) : null}

      {error ? <p className="text-sm text-weak">{error}</p> : null}

      <div className="flex flex-wrap gap-2">
        {!status?.connected && !login ? (
          <button type="button" className="spool-button" onClick={startLogin} disabled={loading}>
            {loading ? "Starting..." : "Start ChatGPT login"}
          </button>
        ) : null}
        {login ? (
          <button type="button" className="spool-button-secondary" onClick={cancelLogin} disabled={loading}>
            Cancel login
          </button>
        ) : null}
        {status?.connected ? (
          <button type="button" className="spool-button-secondary" onClick={logout} disabled={loading}>
            Logout
          </button>
        ) : null}
        <button type="button" className="spool-button-secondary" onClick={refreshWithError} disabled={loading}>
          Refresh status
        </button>
      </div>
    </section>
  );
}
