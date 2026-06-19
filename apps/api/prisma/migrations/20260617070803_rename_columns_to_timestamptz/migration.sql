/*
  Warnings:

  - You are about to drop the column `isActive` on the `OdooAccount` table. All the data in the column will be lost.
  - You are about to drop the column `lastOffset` on the `OdooAccount` table. All the data in the column will be lost.
  - You are about to drop the column `lastSyncAt` on the `OdooAccount` table. All the data in the column will be lost.
  - You are about to drop the column `lastSyncBy` on the `OdooAccount` table. All the data in the column will be lost.
  - You are about to drop the column `lastSyncCount` on the `OdooAccount` table. All the data in the column will be lost.
  - You are about to drop the column `lastSyncError` on the `OdooAccount` table. All the data in the column will be lost.
  - You are about to drop the column `lastSyncStatus` on the `OdooAccount` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "Inventory_sku_key";

-- AlterTable
ALTER TABLE "AuditLog" ALTER COLUMN "timestamp" SET DATA TYPE TIMESTAMPTZ(3);

-- AlterTable
ALTER TABLE "DailyStockSnapshot" ALTER COLUMN "date" SET DATA TYPE TIMESTAMPTZ(3);

-- AlterTable
ALTER TABLE "DocumentReference" ALTER COLUMN "scheduledDate" SET DATA TYPE TIMESTAMPTZ(3),
ALTER COLUMN "dateDone" SET DATA TYPE TIMESTAMPTZ(3),
ALTER COLUMN "lastSyncedAt" SET DATA TYPE TIMESTAMPTZ(3),
ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMPTZ(3),
ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMPTZ(3);

-- AlterTable
ALTER TABLE "DocumentReferenceItem" ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMPTZ(3),
ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMPTZ(3);

-- AlterTable
ALTER TABLE "FileAttachment" ALTER COLUMN "uploadedAt" SET DATA TYPE TIMESTAMPTZ(3);

-- AlterTable
ALTER TABLE "GateDocumentReference" ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMPTZ(3);

-- AlterTable
ALTER TABLE "GateOperation" ADD COLUMN     "clientPartner" TEXT,
ADD COLUMN     "documentReferenceId" INTEGER,
ADD COLUMN     "driverPhone" TEXT,
ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMPTZ(3),
ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMPTZ(3);

-- AlterTable
ALTER TABLE "GateVerification" ALTER COLUMN "verifiedAt" SET DATA TYPE TIMESTAMPTZ(3);

-- AlterTable
ALTER TABLE "Inventory" ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMPTZ(3),
ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMPTZ(3);

-- AlterTable
ALTER TABLE "Location" ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMPTZ(3),
ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMPTZ(3);

-- AlterTable
ALTER TABLE "OdooAccount" DROP COLUMN "isActive",
DROP COLUMN "lastOffset",
DROP COLUMN "lastSyncAt",
DROP COLUMN "lastSyncBy",
DROP COLUMN "lastSyncCount",
DROP COLUMN "lastSyncError",
DROP COLUMN "lastSyncStatus",
ADD COLUMN     "lastDocumentsOffset" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "lastSyncDocumentsAt" TIMESTAMPTZ(3),
ADD COLUMN     "lastSyncDocumentsBy" TEXT,
ADD COLUMN     "lastSyncDocumentsCount" INTEGER,
ADD COLUMN     "lastSyncDocumentsError" TEXT,
ADD COLUMN     "lastSyncDocumentsStatus" TEXT,
ADD COLUMN     "lastSyncInventoryAt" TIMESTAMPTZ(3),
ADD COLUMN     "lastSyncInventoryBy" TEXT,
ADD COLUMN     "lastSyncInventoryCount" INTEGER,
ADD COLUMN     "lastSyncInventoryError" TEXT,
ADD COLUMN     "lastSyncInventoryStatus" TEXT,
ALTER COLUMN "sessionExpiredAt" SET DATA TYPE TIMESTAMPTZ(3),
ALTER COLUMN "lastLoginAt" SET DATA TYPE TIMESTAMPTZ(3),
ALTER COLUMN "lastRefreshAt" SET DATA TYPE TIMESTAMPTZ(3),
ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMPTZ(3),
ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMPTZ(3);

-- AlterTable
ALTER TABLE "OdooSyncLog" ALTER COLUMN "startedAt" SET DATA TYPE TIMESTAMPTZ(3),
ALTER COLUMN "finishedAt" SET DATA TYPE TIMESTAMPTZ(3),
ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMPTZ(3),
ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMPTZ(3);

-- AlterTable
ALTER TABLE "Order" ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMPTZ(3),
ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMPTZ(3);

-- AlterTable
ALTER TABLE "PasswordResetToken" ALTER COLUMN "expiresAt" SET DATA TYPE TIMESTAMPTZ(3),
ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMPTZ(3);

-- AlterTable
ALTER TABLE "Permission" ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMPTZ(3),
ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMPTZ(3);

-- AlterTable
ALTER TABLE "Quant" ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMPTZ(3),
ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMPTZ(3);

-- AlterTable
ALTER TABLE "Role" ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMPTZ(3),
ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMPTZ(3);

-- AlterTable
ALTER TABLE "Session" ALTER COLUMN "expiresAt" SET DATA TYPE TIMESTAMPTZ(3),
ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMPTZ(3),
ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMPTZ(3);

-- AlterTable
ALTER TABLE "StockOpname" ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMPTZ(3),
ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMPTZ(3),
ALTER COLUMN "completionDate" SET DATA TYPE TIMESTAMPTZ(3);

-- AlterTable
ALTER TABLE "User" ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMPTZ(3),
ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMPTZ(3);

-- AlterTable
ALTER TABLE "Warehouse" ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMPTZ(3),
ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMPTZ(3);

-- CreateTable
CREATE TABLE "document_categories" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "deleted_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "document_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "signature_templates" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "page_number" INTEGER NOT NULL,
    "pos_x" DOUBLE PRECISION NOT NULL,
    "pos_y" DOUBLE PRECISION NOT NULL,
    "width" DOUBLE PRECISION NOT NULL,
    "height" DOUBLE PRECISION NOT NULL,
    "qr_pos_x" DOUBLE PRECISION NOT NULL,
    "qr_pos_y" DOUBLE PRECISION NOT NULL,
    "qr_width" DOUBLE PRECISION NOT NULL,
    "qr_height" DOUBLE PRECISION NOT NULL,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "deleted_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "signature_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "manual_documents" (
    "id" SERIAL NOT NULL,
    "uuid" TEXT NOT NULL,
    "warehouse_id" INTEGER,
    "title" TEXT NOT NULL,
    "category_id" INTEGER NOT NULL,
    "description" TEXT,
    "file_url" TEXT NOT NULL,
    "file_key" TEXT,
    "uploaded_by" INTEGER NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "manual_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "signed_documents" (
    "id" SERIAL NOT NULL,
    "uuid" TEXT NOT NULL,
    "warehouse_id" INTEGER,
    "source_type" TEXT NOT NULL,
    "source_document_id" INTEGER,
    "title" TEXT NOT NULL,
    "category_id" INTEGER NOT NULL,
    "signed_pdf_url" TEXT NOT NULL,
    "file_key" TEXT,
    "file_hash" TEXT,
    "original_file_key" TEXT,
    "verification_token" TEXT NOT NULL,
    "signed_by" INTEGER NOT NULL,
    "signed_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "signature_template_id" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'VALID',
    "deleted_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "signed_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_verification_logs" (
    "id" SERIAL NOT NULL,
    "signed_document_id" INTEGER NOT NULL,
    "verification_token" TEXT NOT NULL,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "verified_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "document_verification_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER,
    "action" TEXT NOT NULL,
    "document_id" INTEGER,
    "metadata" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_signatures" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "file_url" TEXT NOT NULL,
    "file_key" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "user_signatures_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "manual_documents_uuid_key" ON "manual_documents"("uuid");

-- CreateIndex
CREATE INDEX "manual_documents_uuid_idx" ON "manual_documents"("uuid");

-- CreateIndex
CREATE INDEX "manual_documents_warehouse_id_idx" ON "manual_documents"("warehouse_id");

-- CreateIndex
CREATE UNIQUE INDEX "signed_documents_uuid_key" ON "signed_documents"("uuid");

-- CreateIndex
CREATE UNIQUE INDEX "signed_documents_verification_token_key" ON "signed_documents"("verification_token");

-- CreateIndex
CREATE INDEX "signed_documents_uuid_idx" ON "signed_documents"("uuid");

-- CreateIndex
CREATE INDEX "signed_documents_warehouse_id_idx" ON "signed_documents"("warehouse_id");

-- AddForeignKey
ALTER TABLE "GateOperation" ADD CONSTRAINT "GateOperation_documentReferenceId_fkey" FOREIGN KEY ("documentReferenceId") REFERENCES "DocumentReference"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "manual_documents" ADD CONSTRAINT "manual_documents_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "document_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "manual_documents" ADD CONSTRAINT "manual_documents_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "manual_documents" ADD CONSTRAINT "manual_documents_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "Warehouse"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "signed_documents" ADD CONSTRAINT "signed_documents_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "document_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "signed_documents" ADD CONSTRAINT "signed_documents_signature_template_id_fkey" FOREIGN KEY ("signature_template_id") REFERENCES "signature_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "signed_documents" ADD CONSTRAINT "signed_documents_signed_by_fkey" FOREIGN KEY ("signed_by") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "signed_documents" ADD CONSTRAINT "signed_documents_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "Warehouse"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_verification_logs" ADD CONSTRAINT "document_verification_logs_signed_document_id_fkey" FOREIGN KEY ("signed_document_id") REFERENCES "signed_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_signatures" ADD CONSTRAINT "user_signatures_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
