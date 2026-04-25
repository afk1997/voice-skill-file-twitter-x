"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

const fields = [
  { name: "name", label: "Brand name", required: true, placeholder: "Acme" },
  { name: "twitterHandle", label: "Twitter/X handle", required: false, placeholder: "@acme" },
  { name: "website", label: "Website", required: false, placeholder: "https://acme.com" },
  { name: "category", label: "Category", required: false, placeholder: "Founder, SaaS, agency, creator" },
] as const;

export function BrandForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);
    const formData = new FormData(event.currentTarget);
    const payload = Object.fromEntries(formData.entries());
    const response = await fetch("/api/brands", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    const json = await response.json();
    setLoading(false);
    if (!response.ok) {
      setError(json.error || "Could not create brand.");
      return;
    }
    router.push(`/brands/${json.brand.id}`);
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5 rounded-ui border border-line bg-white p-5">
      <div className="grid gap-4 md:grid-cols-2">
        {fields.map((field) => (
          <label key={field.name} className="space-y-1">
            <span className="text-sm font-medium text-ink">{field.label}</span>
            <input
              name={field.name}
              required={field.required}
              className="w-full rounded-ui border border-line px-3 py-2 text-sm"
              placeholder={field.placeholder}
            />
          </label>
        ))}
      </div>

      <label className="block space-y-1">
        <span className="text-sm font-medium text-ink">Target audience</span>
        <textarea name="audience" className="min-h-20 w-full rounded-ui border border-line px-3 py-2 text-sm" placeholder="Who should this voice speak to?" />
      </label>

      <label className="block space-y-1">
        <span className="text-sm font-medium text-ink">Short brand description</span>
        <textarea name="description" className="min-h-20 w-full rounded-ui border border-line px-3 py-2 text-sm" placeholder="What does the brand do?" />
      </label>

      <label className="block space-y-1">
        <span className="text-sm font-medium text-ink">Things the brand believes</span>
        <textarea name="beliefs" className="min-h-24 w-full rounded-ui border border-line px-3 py-2 text-sm" placeholder="One belief per line works well." />
      </label>

      <label className="block space-y-1">
        <span className="text-sm font-medium text-ink">Things the brand should avoid sounding like</span>
        <textarea name="avoidSoundingLike" className="min-h-24 w-full rounded-ui border border-line px-3 py-2 text-sm" placeholder="Corporate, hype-heavy, vague, too polished..." />
      </label>

      {error ? <p className="text-sm text-weak">{error}</p> : null}

      <button type="submit" disabled={loading} className="rounded-ui bg-ink px-4 py-2 text-sm font-medium text-white disabled:opacity-60">
        {loading ? "Creating..." : "Create workspace"}
      </button>
    </form>
  );
}
