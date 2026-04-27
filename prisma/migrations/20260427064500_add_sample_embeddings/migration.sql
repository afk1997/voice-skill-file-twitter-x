-- AlterTable
ALTER TABLE "ContentSample" ADD COLUMN "embeddingJson" TEXT;
ALTER TABLE "ContentSample" ADD COLUMN "embeddingModel" TEXT;
ALTER TABLE "ContentSample" ADD COLUMN "embeddingHash" TEXT;
ALTER TABLE "ContentSample" ADD COLUMN "embeddedAt" DATETIME;

-- CreateIndex
CREATE INDEX "ContentSample_brandId_embeddingModel_idx" ON "ContentSample"("brandId", "embeddingModel");
