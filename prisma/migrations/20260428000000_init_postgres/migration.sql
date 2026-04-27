-- CreateTable
CREATE TABLE "Brand" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "twitterHandle" TEXT,
    "website" TEXT,
    "category" TEXT,
    "audience" TEXT,
    "description" TEXT,
    "beliefs" TEXT,
    "avoidSoundingLike" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Brand_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Upload" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileType" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "totalItems" INTEGER NOT NULL DEFAULT 0,
    "usefulItems" INTEGER NOT NULL DEFAULT 0,
    "excludedItems" INTEGER NOT NULL DEFAULT 0,
    "summaryJson" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Upload_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContentSample" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "uploadId" TEXT,
    "rawText" TEXT NOT NULL,
    "cleanedText" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "classification" TEXT NOT NULL,
    "qualityScore" INTEGER NOT NULL,
    "usedForVoice" BOOLEAN NOT NULL DEFAULT false,
    "metadataJson" TEXT,
    "embeddingJson" TEXT,
    "embeddingModel" TEXT,
    "embeddingHash" TEXT,
    "embeddedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContentSample_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VoiceReportRecord" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "reportJson" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VoiceReportRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SkillFile" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "skillJson" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SkillFile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Generation" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "tweetType" TEXT NOT NULL,
    "outputText" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "scoreLabel" TEXT NOT NULL,
    "reason" TEXT,
    "issuesJson" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Generation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Feedback" (
    "id" TEXT NOT NULL,
    "generationId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Feedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppSetting" (
    "key" TEXT NOT NULL,
    "valueJson" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppSetting_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE INDEX "ContentSample_brandId_usedForVoice_idx" ON "ContentSample"("brandId", "usedForVoice");

-- CreateIndex
CREATE INDEX "ContentSample_brandId_classification_idx" ON "ContentSample"("brandId", "classification");

-- CreateIndex
CREATE INDEX "ContentSample_brandId_embeddingModel_idx" ON "ContentSample"("brandId", "embeddingModel");

-- CreateIndex
CREATE INDEX "SkillFile_brandId_createdAt_idx" ON "SkillFile"("brandId", "createdAt");

-- AddForeignKey
ALTER TABLE "Upload" ADD CONSTRAINT "Upload_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentSample" ADD CONSTRAINT "ContentSample_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoiceReportRecord" ADD CONSTRAINT "VoiceReportRecord_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkillFile" ADD CONSTRAINT "SkillFile_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Generation" ADD CONSTRAINT "Generation_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Feedback" ADD CONSTRAINT "Feedback_generationId_fkey" FOREIGN KEY ("generationId") REFERENCES "Generation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
