import { ProviderSettingsForm } from "@/components/settings/ProviderSettingsForm";
import { PageHeader } from "@/components/ui/PageHeader";
import { ensureCurrentUserProfileForPage } from "@/lib/auth/currentUserProfile";

export default async function SettingsPage() {
  await ensureCurrentUserProfileForPage();

  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader
        eyebrow="Settings"
        title="Provider Settings"
        description="Bring your own key for Anthropic, OpenAI, OpenRouter, or an OpenAI-compatible endpoint. API keys are stored only in this browser's localStorage."
      />
      <ProviderSettingsForm />
    </div>
  );
}
