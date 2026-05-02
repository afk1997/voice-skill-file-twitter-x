import { BrandForm } from "@/components/brands/BrandForm";
import { PageHeader } from "@/components/ui/PageHeader";
import { ensureCurrentUserProfileForPage } from "@/lib/auth/currentUserProfile";

export default async function NewBrandPage() {
  await ensureCurrentUserProfileForPage();

  return (
    <div className="max-w-4xl space-y-6">
      <PageHeader
        eyebrow="New workspace"
        title="Create Brand Voice Workspace"
        description="Capture the context the voice file should preserve."
      />
      <BrandForm />
    </div>
  );
}
