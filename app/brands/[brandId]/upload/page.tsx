import Link from "next/link";
import { notFound } from "next/navigation";
import { DeleteUploadButton } from "@/components/uploads/DeleteUploadButton";
import { UploadForm } from "@/components/uploads/UploadForm";
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
      <div className="flex items-start justify-between gap-4 border-b border-line pb-6">
        <div>
          <p className="text-sm font-medium text-accent">{brand.name}</p>
          <h1 className="mt-2 text-3xl font-semibold text-ink">Upload Content</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">Upload past Twitter/X writing so the app can parse, clean, and identify useful voice samples.</p>
        </div>
        <Link href={`/brands/${brand.id}`} className="text-sm text-muted hover:text-ink">
          Brand dashboard
        </Link>
      </div>

      <UploadForm brandId={brand.id} />

      {usefulSampleCount > 0 ? (
        <section className="flex flex-col gap-3 rounded-ui border border-line bg-panel p-5 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-ink">Ready for voice analysis</h2>
            <p className="mt-1 text-sm text-muted">
              {usefulSampleCount.toLocaleString()} useful samples are available. Analyze them to create or refresh the Voice Skill File.
            </p>
          </div>
          <Link href={`/brands/${brand.id}/voice-report`} className="rounded-ui bg-ink px-4 py-2 text-center text-sm font-medium text-white">
            Analyze voice
          </Link>
        </section>
      ) : null}

      <section>
        <h2 className="text-xl font-semibold text-ink">Recent uploads</h2>
        {brand.uploads.length === 0 ? (
          <p className="mt-2 text-sm text-muted">No uploads yet.</p>
        ) : (
          <div className="mt-4 overflow-hidden rounded-ui border border-line">
            <table className="w-full border-collapse text-left text-sm">
              <thead className="bg-panel text-muted">
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
