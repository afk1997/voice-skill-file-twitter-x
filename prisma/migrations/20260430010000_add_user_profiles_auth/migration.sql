CREATE TYPE "BrandMembershipRole" AS ENUM ('owner');

CREATE TABLE "UserProfile" (
    "id" TEXT NOT NULL,
    "clerkUserId" TEXT NOT NULL,
    "email" TEXT,
    "displayName" TEXT,
    "imageUrl" TEXT,
    "bio" TEXT,
    "defaultBrandId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "UserProfile_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BrandMembership" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "userProfileId" TEXT NOT NULL,
    "role" "BrandMembershipRole" NOT NULL DEFAULT 'owner',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "BrandMembership_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "RuleBankRule" ADD COLUMN "userProfileId" TEXT;

CREATE UNIQUE INDEX "UserProfile_clerkUserId_key" ON "UserProfile"("clerkUserId");
CREATE INDEX "UserProfile_email_idx" ON "UserProfile"("email");
CREATE UNIQUE INDEX "BrandMembership_brandId_userProfileId_key" ON "BrandMembership"("brandId", "userProfileId");
CREATE INDEX "BrandMembership_userProfileId_role_idx" ON "BrandMembership"("userProfileId", "role");
CREATE INDEX "BrandMembership_brandId_role_idx" ON "BrandMembership"("brandId", "role");
CREATE INDEX "RuleBankRule_userProfileId_scope_source_idx" ON "RuleBankRule"("userProfileId", "scope", "source");

ALTER TABLE "BrandMembership" ADD CONSTRAINT "BrandMembership_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BrandMembership" ADD CONSTRAINT "BrandMembership_userProfileId_fkey" FOREIGN KEY ("userProfileId") REFERENCES "UserProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RuleBankRule" ADD CONSTRAINT "RuleBankRule_userProfileId_fkey" FOREIGN KEY ("userProfileId") REFERENCES "UserProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
