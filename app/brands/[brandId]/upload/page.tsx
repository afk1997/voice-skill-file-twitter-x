import Link from "next/link";
import { notFound } from "next/navigation";
import { DeleteUploadButton } from "@/components/uploads/DeleteUploadButton";
import { UploadForm } from "@/components/uploads/UploadForm";
import { PageHeader } from "@/components/ui/PageHeader";
import { prisma } from "@/lib/db";
import { parseJsonField } from "@/lib/request";

export const dynamic = "force-dynamic";

export default async function UploadPage({ params }: { params: Promise<{ brandId: string }> }) {
  const { brandId } = await params;
  const brand = await prisma.brand.findUnique({
    where: { id: brandId },
    include: { uploads: { orderBy: { createdAt: "desc" }, take: 10 } },
  });

  if (!brand) notFound();

  const usefulSampleCount = await prisma.contentSample.count({
    where: { brandId, usedForVoice: true },
  });

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow={brand.name}
        title="Upload Content"
        description="Upload past Twitter/X writing so Spool can parse, clean, and identify useful voice samples."
        actions={
          <Link href={`/brands/${brand.id}`} className="spool-button-secondary text-sm">
            Brand dashboard
          </Link>
        }
      />

      <UploadForm brandId={brand.id} />

      {usefulSampleCount > 0 ? (
        <section className="spool-plate-soft flex flex-col gap-3 p-5 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-ink">Ready for voice analysis</h2>
            <p className="mt-1 text-sm text-muted">
              {usefulSampleCount.toLocaleString()} useful samples are available. Analyze them to create or refresh the Skill File.
            </p>
          </div>
          <Link href={`/brands/${brand.id}/voice-report`} className="spool-button text-center">
            Analyze voice
          </Link>
        </section>
      ) : null}

      <section>
        <h2 className="text-xl font-semibold text-ink">Recent uploads</h2>
        {brand.uploads.length === 0 ? (
          <p className="mt-2 text-sm text-muted">No uploads yet.</p>
        ) : (
          <div className="mt-4 overflow-x-auto border-[1.5px] border-ink bg-light shadow-stamp">
            <table className="w-full border-collapse text-left text-sm">
              <thead className="bg-surface text-muted">
                <tr>
                  <th className="px-3 py-2 font-medium">File</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                  <th className="px-3 py-2 font-medium">Useful</th>
                  <th className="px-3 py-2 font-medium">Excluded</th>
                  <th className="px-3 py-2 font-medium">Summary</th>
                  <th className="px-3 py-2 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {brand.uploads.map((upload) => {
                  const summary = parseJsonField<{ imported?: number; counts?: Record<string, number>; error?: string } | null>(upload.summaryJson, null);
                  return (
                    <tr key={upload.id} className="border-t border-line">
                      <td className="px-3 py-2 text-ink">{upload.fileName}</td>
                      <td className="px-3 py-2 text-muted">{upload.status}</td>
                      <td className="px-3 py-2 text-muted">{upload.usefulItems}</td>
                      <td className="px-3 py-2 text-muted">{upload.excludedItems}</td>
                      <td className="px-3 py-2 text-muted">
                        {summary?.error || (summary?.imported ? `${summary.imported} imported` : `${upload.totalItems} found`)}
                      </td>
                      <td className="px-3 py-2">
                        <DeleteUploadButton brandId={brand.id} uploadId={upload.id} fileName={upload.fileName} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
