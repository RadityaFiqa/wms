/*
  Warnings:

  - You are about to drop the column `vehiclePhotoId` on the `GateOperation` table. All the data in the column will be lost.
  - You are about to drop the column `attachmentId` on the `GateVerification` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "ErpSyncStatus" AS ENUM ('PENDING', 'RUNNING', 'SUCCESS', 'FAILED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "VerificationStatus" ADD VALUE 'PARTIAL';
ALTER TYPE "VerificationStatus" ADD VALUE 'COMPLETED';
ALTER TYPE "VerificationStatus" ADD VALUE 'CANCELED';

-- DropForeignKey
ALTER TABLE "GateOperation" DROP CONSTRAINT "GateOperation_vehiclePhotoId_fkey";

-- DropForeignKey
ALTER TABLE "GateVerification" DROP CONSTRAINT "GateVerification_attachmentId_fkey";

-- DropIndex
DROP INDEX "GateOperation_vehiclePhotoId_key";

-- DropIndex
DROP INDEX "GateVerification_attachmentId_key";

-- AlterTable
ALTER TABLE "FileAttachment" ADD COLUMN     "gateOperationId" INTEGER,
ADD COLUMN     "gateVerificationId" INTEGER;

-- AlterTable
ALTER TABLE "GateOperation" DROP COLUMN "vehiclePhotoId",
ADD COLUMN     "poReferences" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "soReferences" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "GateVerification" DROP COLUMN "attachmentId",
ALTER COLUMN "status" SET DEFAULT 'PENDING';

-- CreateTable
CREATE TABLE "DocumentReference" (
    "id" SERIAL NOT NULL,
    "uuid" TEXT NOT NULL,
    "warehouseId" INTEGER NOT NULL,
    "erpId" INTEGER NOT NULL,
    "documentNumber" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "pickingTypeCode" TEXT NOT NULL,
    "partnerName" TEXT,
    "purchaseName" TEXT,
    "origin" TEXT,
    "sourceLocationName" TEXT,
    "destinationLocationName" TEXT,
    "scheduledDate" TIMESTAMP(3),
    "dateDone" TIMESTAMP(3),
    "driver" TEXT,
    "plateNumber" TEXT,
    "totalItems" INTEGER NOT NULL,
    "totalQuantity" DOUBLE PRECISION NOT NULL,
    "rawPayload" JSONB NOT NULL,
    "lastSyncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DocumentReference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentReferenceItem" (
    "id" SERIAL NOT NULL,
    "uuid" TEXT NOT NULL,
    "documentReferenceId" INTEGER NOT NULL,
    "productId" INTEGER NOT NULL,
    "productName" TEXT NOT NULL,
    "uom" TEXT NOT NULL,
    "analyticAccountName" TEXT,
    "quantity" DOUBLE PRECISION NOT NULL,
    "productQty" DOUBLE PRECISION NOT NULL,
    "secondaryQuantity" DOUBLE PRECISION,
    "secondaryUom" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DocumentReferenceItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "erp_document_sync_logs" (
    "id" SERIAL NOT NULL,
    "uuid" TEXT NOT NULL,
    "warehouse_id" INTEGER NOT NULL,
    "status" "ErpSyncStatus" NOT NULL,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finished_at" TIMESTAMP(3),
    "total_documents" INTEGER NOT NULL DEFAULT 0,
    "processed_documents" INTEGER NOT NULL DEFAULT 0,
    "error_message" TEXT,
    "created_by" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "erp_document_sync_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gate_verification_references" (
    "id" SERIAL NOT NULL,
    "uuid" TEXT NOT NULL,
    "gate_verification_id" INTEGER NOT NULL,
    "gate_item_id" INTEGER NOT NULL,
    "erp_document_id" INTEGER NOT NULL,
    "erp_document_item_id" INTEGER NOT NULL,
    "product_id" INTEGER NOT NULL,
    "assigned_quantity" DOUBLE PRECISION NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" TEXT NOT NULL,

    CONSTRAINT "gate_verification_references_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DocumentReference_uuid_key" ON "DocumentReference"("uuid");

-- CreateIndex
CREATE INDEX "DocumentReference_warehouseId_idx" ON "DocumentReference"("warehouseId");

-- CreateIndex
CREATE INDEX "DocumentReference_uuid_idx" ON "DocumentReference"("uuid");

-- CreateIndex
CREATE INDEX "DocumentReference_documentNumber_idx" ON "DocumentReference"("documentNumber");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentReference_warehouseId_erpId_key" ON "DocumentReference"("warehouseId", "erpId");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentReferenceItem_uuid_key" ON "DocumentReferenceItem"("uuid");

-- CreateIndex
CREATE INDEX "DocumentReferenceItem_documentReferenceId_idx" ON "DocumentReferenceItem"("documentReferenceId");

-- CreateIndex
CREATE UNIQUE INDEX "erp_document_sync_logs_uuid_key" ON "erp_document_sync_logs"("uuid");

-- CreateIndex
CREATE INDEX "erp_document_sync_logs_warehouse_id_idx" ON "erp_document_sync_logs"("warehouse_id");

-- CreateIndex
CREATE INDEX "erp_document_sync_logs_uuid_idx" ON "erp_document_sync_logs"("uuid");

-- CreateIndex
CREATE UNIQUE INDEX "gate_verification_references_uuid_key" ON "gate_verification_references"("uuid");

-- CreateIndex
CREATE INDEX "gate_verification_references_gate_verification_id_idx" ON "gate_verification_references"("gate_verification_id");

-- CreateIndex
CREATE INDEX "gate_verification_references_gate_item_id_idx" ON "gate_verification_references"("gate_item_id");

-- CreateIndex
CREATE INDEX "gate_verification_references_erp_document_id_idx" ON "gate_verification_references"("erp_document_id");

-- CreateIndex
CREATE INDEX "gate_verification_references_erp_document_item_id_idx" ON "gate_verification_references"("erp_document_item_id");

-- CreateIndex
CREATE INDEX "gate_verification_references_product_id_idx" ON "gate_verification_references"("product_id");

-- AddForeignKey
ALTER TABLE "FileAttachment" ADD CONSTRAINT "FileAttachment_gateOperationId_fkey" FOREIGN KEY ("gateOperationId") REFERENCES "GateOperation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FileAttachment" ADD CONSTRAINT "FileAttachment_gateVerificationId_fkey" FOREIGN KEY ("gateVerificationId") REFERENCES "GateVerification"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentReference" ADD CONSTRAINT "DocumentReference_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentReferenceItem" ADD CONSTRAINT "DocumentReferenceItem_documentReferenceId_fkey" FOREIGN KEY ("documentReferenceId") REFERENCES "DocumentReference"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "erp_document_sync_logs" ADD CONSTRAINT "erp_document_sync_logs_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "Warehouse"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gate_verification_references" ADD CONSTRAINT "gate_verification_references_gate_verification_id_fkey" FOREIGN KEY ("gate_verification_id") REFERENCES "GateVerification"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gate_verification_references" ADD CONSTRAINT "gate_verification_references_gate_item_id_fkey" FOREIGN KEY ("gate_item_id") REFERENCES "GateOperationProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gate_verification_references" ADD CONSTRAINT "gate_verification_references_erp_document_id_fkey" FOREIGN KEY ("erp_document_id") REFERENCES "DocumentReference"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gate_verification_references" ADD CONSTRAINT "gate_verification_references_erp_document_item_id_fkey" FOREIGN KEY ("erp_document_item_id") REFERENCES "DocumentReferenceItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
