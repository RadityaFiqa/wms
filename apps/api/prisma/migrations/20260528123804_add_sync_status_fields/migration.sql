-- AlterTable
ALTER TABLE "OdooAccount" ADD COLUMN     "lastSyncAt" TIMESTAMP(3),
ADD COLUMN     "lastSyncBy" TEXT,
ADD COLUMN     "lastSyncCount" INTEGER,
ADD COLUMN     "lastSyncError" TEXT,
ADD COLUMN     "lastSyncStatus" TEXT;
