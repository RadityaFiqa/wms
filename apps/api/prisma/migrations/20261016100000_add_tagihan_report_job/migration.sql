-- CreateEnum
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'TagihanJobStatus') THEN
        CREATE TYPE "TagihanJobStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');
    END IF;
END $$;

-- AlterTable TagihanFile
ALTER TABLE "TagihanFile" ADD COLUMN IF NOT EXISTS "fileType" TEXT DEFAULT 'MANUAL';
ALTER TABLE "TagihanFile" ADD COLUMN IF NOT EXISTS "fingerprint" TEXT;
ALTER TABLE "TagihanFile" ADD COLUMN IF NOT EXISTS "generatedAt" TIMESTAMPTZ(3);
ALTER TABLE "TagihanFile" ADD COLUMN IF NOT EXISTS "jobId" TEXT;

CREATE INDEX IF NOT EXISTS "TagihanFile_fileType_idx" ON "TagihanFile"("fileType");
CREATE INDEX IF NOT EXISTS "TagihanFile_fingerprint_idx" ON "TagihanFile"("fingerprint");

-- CreateTable: TagihanReportJob
CREATE TABLE IF NOT EXISTS "TagihanReportJob" (
    "id" SERIAL NOT NULL,
    "uuid" TEXT NOT NULL,
    "tagihanId" INTEGER NOT NULL,
    "reportType" TEXT NOT NULL,
    "status" "TagihanJobStatus" NOT NULL DEFAULT 'PENDING',
    "fingerprint" TEXT NOT NULL,
    "progress" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,
    "tagihanFileId" INTEGER,
    "startedAt" TIMESTAMPTZ(3),
    "completedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TagihanReportJob_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "TagihanReportJob_uuid_key" ON "TagihanReportJob"("uuid");
CREATE INDEX IF NOT EXISTS "TagihanReportJob_tagihanId_idx" ON "TagihanReportJob"("tagihanId");
CREATE INDEX IF NOT EXISTS "TagihanReportJob_uuid_idx" ON "TagihanReportJob"("uuid");
CREATE INDEX IF NOT EXISTS "TagihanReportJob_status_idx" ON "TagihanReportJob"("status");
CREATE INDEX IF NOT EXISTS "TagihanReportJob_reportType_idx" ON "TagihanReportJob"("reportType");
CREATE INDEX IF NOT EXISTS "TagihanReportJob_tagihanId_reportType_idx" ON "TagihanReportJob"("tagihanId", "reportType");

-- Add foreign keys safely
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'TagihanReportJob_tagihanId_fkey') THEN
        ALTER TABLE "TagihanReportJob" ADD CONSTRAINT "TagihanReportJob_tagihanId_fkey" FOREIGN KEY ("tagihanId") REFERENCES "Tagihan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'TagihanReportJob_tagihanFileId_fkey') THEN
        ALTER TABLE "TagihanReportJob" ADD CONSTRAINT "TagihanReportJob_tagihanFileId_fkey" FOREIGN KEY ("tagihanFileId") REFERENCES "TagihanFile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;
