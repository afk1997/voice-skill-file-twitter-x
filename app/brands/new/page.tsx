import { BrandForm } from "@/components/brands/BrandForm";

export default function NewBrandPage() {
  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-3xl font-semibold text-ink">Create Brand Voice Workspace</h1>
        <p className="mt-2 text-sm text-muted">Capture the context the voice file should preserve.</p>
      </div>
      <BrandForm />
    </div>
  );
}
