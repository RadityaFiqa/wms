-- AlterTable TagihanReportJob: additive progress tracking columns
ALTER TABLE "TagihanReportJob" ADD COLUMN IF NOT EXISTS "stage" TEXT;
ALTER TABLE "TagihanReportJob" ADD COLUMN IF NOT EXISTS "processedCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "TagihanReportJob" ADD COLUMN IF NOT EXISTS "totalCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "TagihanReportJob" ADD COLUMN IF NOT EXISTS "currentItem" TEXT;
