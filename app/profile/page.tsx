import { ProfileForm } from "@/components/profile/ProfileForm";
import { PageHeader } from "@/components/ui/PageHeader";
import { ensureCurrentUserProfile, serializeProfile } from "@/lib/auth/currentUserProfile";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const profile = serializeProfile(await ensureCurrentUserProfile());

  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader eyebrow="Account" title="Profile" description="Manage the app-local profile attached to your signed-in account." />
      <ProfileForm profile={profile} />
    </div>
  );
}
