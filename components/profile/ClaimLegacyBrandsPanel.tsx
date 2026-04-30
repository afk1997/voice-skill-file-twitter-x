"use client";

import { useRouter } from "next/navigation";
import React, { useState } from "react";

type LegacyBrand = {
  id: string;
  name: string;
  twitterHandle?: string | null;
  category?: string | null;
};

export function ClaimLegacyBrandsPanel({ brands }: { brands: LegacyBrand[] }) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function claim() {
    setMessage("");
    setError("");
    setLoading(true);
    const response = await fetch("/api/profile/claim-legacy-brands", { method: "POST" });
    const json = await response.json();
    setLoading(false);
    if (!response.ok) {
      setError(json.error || "Could not claim existing workspaces.");
      return;
    }
    setMessage(`Claimed ${json.claimedCount} workspaces.`);
    router.refresh();
  }

  return (
    <section className="spool-plate-soft p-5">
      <p className="text-xs font-semibold uppercase text-muted">Existing workspaces</p>
      <h2 className="mt-1 text-xl font-semibold text-ink">Claim existing workspaces</h2>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
        These workspaces were created before app accounts existed. Claim them to attach them to your profile.
      </p>
      <div className="mt-3 flex flex-wrap gap-2 text-sm text-muted">
        {brands.slice(0, 4).map((brand) => (
          <span key={brand.id} className="border border-line bg-light px-2 py-1">
            {brand.name}
          </span>
        ))}
      </div>
      {message ? <p className="mt-3 text-sm text-good">{message}</p> : null}
      {error ? <p className="mt-3 text-sm text-weak">{error}</p> : null}
      <button type="button" onClick={claim} disabled={loading} className="spool-button mt-4 disabled:opacity-60">
        {loading ? "Claiming..." : "Claim existing workspaces"}
      </button>
    </section>
  );
}
