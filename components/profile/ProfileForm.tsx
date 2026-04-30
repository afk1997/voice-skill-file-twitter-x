"use client";

import React, { useState } from "react";

export function ProfileForm({ profile }: { profile: { displayName: string; bio: string } }) {
  const [displayName, setDisplayName] = useState(profile.displayName);
  const [bio, setBio] = useState(profile.bio);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("");
    setError("");
    setLoading(true);
    const response = await fetch("/api/profile", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ displayName, bio }),
    });
    const json = await response.json();
    setLoading(false);
    if (!response.ok) {
      setError(json.error || "Could not save profile.");
      return;
    }
    setStatus("Profile saved.");
  }

  return (
    <form onSubmit={submit} className="space-y-4 spool-plate p-5">
      <label className="block space-y-1">
        <span className="text-sm font-medium text-ink">Display name</span>
        <input value={displayName} onChange={(event) => setDisplayName(event.target.value)} className="spool-field w-full" />
      </label>
      <label className="block space-y-1">
        <span className="text-sm font-medium text-ink">Bio</span>
        <textarea value={bio} onChange={(event) => setBio(event.target.value)} className="spool-field min-h-28 w-full" />
      </label>
      {error ? <p className="text-sm text-weak">{error}</p> : null}
      {status ? <p className="text-sm text-good">{status}</p> : null}
      <button type="submit" disabled={loading} className="spool-button disabled:opacity-60">
        {loading ? "Saving..." : "Save profile"}
      </button>
    </form>
  );
}
