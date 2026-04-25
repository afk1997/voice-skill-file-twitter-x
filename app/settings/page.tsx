import { ProviderSettingsForm } from "@/components/settings/ProviderSettingsForm";

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold text-ink">Provider Settings</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
          Bring your own key for Anthropic, OpenAI, OpenRouter, or an OpenAI-compatible endpoint. API keys are stored only in this browser&apos;s localStorage and are not saved to SQLite.
        </p>
      </div>
      <ProviderSettingsForm />
    </div>
  );
}
