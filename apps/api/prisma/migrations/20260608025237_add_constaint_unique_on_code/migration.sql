/*
  Warnings:

  - You are about to drop the column `erpId` on the `DocumentReference` table. All the data in the column will be lost.
  - You are about to drop the column `odooLocationId` on the `Location` table. All the data in the column will be lost.
  - You are about to drop the column `odooProductId` on the `Product` table. All the data in the column will be lost.
  - You are about to drop the column `odooQuantId` on the `Quant` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[code]` on the table `Warehouse` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "StockOpnameStatus" AS ENUM ('DRAFT', 'COMPLETED');

-- DropIndex
DROP INDEX "DocumentReference_warehouseId_erpId_key";

-- DropIndex
DROP INDEX "Location_warehouseId_odooLocationId_key";

-- DropIndex
DROP INDEX "Product_odooProductId_key";

-- DropIndex
DROP INDEX "Quant_odooQuantId_key";

-- AlterTable
ALTER TABLE "DocumentReference" DROP COLUMN "erpId",
ALTER COLUMN "id" DROP DEFAULT;
DROP SEQUENCE "DocumentReference_id_seq";

-- AlterTable
ALTER TABLE "DocumentReferenceItem" ALTER COLUMN "id" DROP DEFAULT;
DROP SEQUENCE "DocumentReferenceItem_id_seq";

-- AlterTable
ALTER TABLE "FileAttachment" ADD COLUMN     "stockOpnameId" INTEGER;

-- AlterTable
ALTER TABLE "GateDocumentReference" RENAME CONSTRAINT "gate_verification_references_pkey" TO "GateDocumentReference_pkey";

-- AlterTable
ALTER TABLE "GateOperationProduct" ADD COLUMN     "notes" TEXT;

-- AlterTable
ALTER TABLE "Location" DROP COLUMN "odooLocationId",
ALTER COLUMN "id" DROP DEFAULT;
DROP SEQUENCE "Location_id_seq";

-- AlterTable
ALTER TABLE "OdooSyncLog" RENAME CONSTRAINT "erp_document_sync_logs_pkey" TO "OdooSyncLog_pkey";

-- AlterTable
ALTER TABLE "Product" DROP COLUMN "odooProductId",
ALTER COLUMN "id" DROP DEFAULT;
DROP SEQUENCE "Product_id_seq";

-- AlterTable
ALTER TABLE "Quant" DROP COLUMN "odooQuantId",
ALTER COLUMN "id" DROP DEFAULT;
DROP SEQUENCE "Quant_id_seq";

-- AlterTable
ALTER TABLE "Warehouse" ADD COLUMN     "address" TEXT,
ADD COLUMN     "code" TEXT NOT NULL DEFAULT 'TEMP',
ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "odooReference" TEXT,
ADD COLUMN     "type" TEXT;

-- AlterTable
ALTER TABLE "WarehouseAccess" RENAME CONSTRAINT "user_warehouse_access_pkey" TO "WarehouseAccess_pkey";

-- CreateTable
CREATE TABLE "StockOpname" (
    "id" SERIAL NOT NULL,
    "uuid" TEXT NOT NULL,
    "opnameNumber" TEXT NOT NULL,
    "warehouseId" INTEGER NOT NULL,
    "status" "StockOpnameStatus" NOT NULL DEFAULT 'DRAFT',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "completionDate" TIMESTAMP(3),
    "createdById" INTEGER NOT NULL,

    CONSTRAINT "StockOpname_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockOpnameItem" (
    "id" SERIAL NOT NULL,
    "uuid" TEXT NOT NULL,
    "stockOpnameId" INTEGER NOT NULL,
    "productId" INTEGER NOT NULL,
    "productSku" TEXT NOT NULL,
    "productName" TEXT NOT NULL,
    "productCategory" TEXT,
    "productUom" TEXT,
    "erpStock" DOUBLE PRECISION NOT NULL,
    "realtimeStock" DOUBLE PRECISION NOT NULL,
    "difference" DOUBLE PRECISION,

    CONSTRAINT "StockOpnameItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockOpnameStack" (
    "id" SERIAL NOT NULL,
    "uuid" TEXT NOT NULL,
    "stockOpnameItemId" INTEGER NOT NULL,
    "locationId" INTEGER NOT NULL,
    "locationName" TEXT NOT NULL,
    "erpQty" DOUBLE PRECISION NOT NULL,
    "actualQty" DOUBLE PRECISION,
    "variance" DOUBLE PRECISION,

    CONSTRAINT "StockOpnameStack_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyStockSnapshot" (
    "id" SERIAL NOT NULL,
    "uuid" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "warehouseId" INTEGER NOT NULL,
    "productId" INTEGER NOT NULL,
    "closingStock" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "DailyStockSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "StockOpname_uuid_key" ON "StockOpname"("uuid");

-- CreateIndex
CREATE UNIQUE INDEX "StockOpname_opnameNumber_key" ON "StockOpname"("opnameNumber");

-- CreateIndex
CREATE INDEX "StockOpname_warehouseId_idx" ON "StockOpname"("warehouseId");

-- CreateIndex
CREATE INDEX "StockOpname_uuid_idx" ON "StockOpname"("uuid");

-- CreateIndex
CREATE INDEX "StockOpname_opnameNumber_idx" ON "StockOpname"("opnameNumber");

-- CreateIndex
CREATE INDEX "StockOpname_status_idx" ON "StockOpname"("status");

-- CreateIndex
CREATE UNIQUE INDEX "StockOpnameItem_uuid_key" ON "StockOpnameItem"("uuid");

-- CreateIndex
CREATE INDEX "StockOpnameItem_stockOpnameId_idx" ON "StockOpnameItem"("stockOpnameId");

-- CreateIndex
CREATE INDEX "StockOpnameItem_productId_idx" ON "StockOpnameItem"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "StockOpnameStack_uuid_key" ON "StockOpnameStack"("uuid");

-- CreateIndex
CREATE INDEX "StockOpnameStack_stockOpnameItemId_idx" ON "StockOpnameStack"("stockOpnameItemId");

-- CreateIndex
CREATE INDEX "StockOpnameStack_locationId_idx" ON "StockOpnameStack"("locationId");

-- CreateIndex
CREATE UNIQUE INDEX "DailyStockSnapshot_uuid_key" ON "DailyStockSnapshot"("uuid");

-- CreateIndex
CREATE INDEX "DailyStockSnapshot_date_idx" ON "DailyStockSnapshot"("date");

-- CreateIndex
CREATE INDEX "DailyStockSnapshot_warehouseId_idx" ON "DailyStockSnapshot"("warehouseId");

-- CreateIndex
CREATE INDEX "DailyStockSnapshot_productId_idx" ON "DailyStockSnapshot"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "DailyStockSnapshot_date_warehouseId_productId_key" ON "DailyStockSnapshot"("date", "warehouseId", "productId");

-- CreateIndex
CREATE UNIQUE INDEX "Warehouse_code_key" ON "Warehouse"("code");

-- CreateIndex
CREATE INDEX "Warehouse_code_idx" ON "Warehouse"("code");

-- RenameForeignKey
ALTER TABLE "GateDocumentReference" RENAME CONSTRAINT "gate_verification_references_erp_document_id_fkey" TO "GateDocumentReference_erpDocumentId_fkey";

-- RenameForeignKey
ALTER TABLE "GateDocumentReference" RENAME CONSTRAINT "gate_verification_references_erp_document_item_id_fkey" TO "GateDocumentReference_erpDocumentItemId_fkey";

-- RenameForeignKey
ALTER TABLE "GateDocumentReference" RENAME CONSTRAINT "gate_verification_references_gate_item_id_fkey" TO "GateDocumentReference_gateItemId_fkey";

-- RenameForeignKey
ALTER TABLE "GateDocumentReference" RENAME CONSTRAINT "gate_verification_references_gate_verification_id_fkey" TO "GateDocumentReference_gateVerificationId_fkey";

-- RenameForeignKey
ALTER TABLE "OdooSyncLog" RENAME CONSTRAINT "erp_document_sync_logs_warehouse_id_fkey" TO "OdooSyncLog_warehouseId_fkey";

-- RenameForeignKey
ALTER TABLE "WarehouseAccess" RENAME CONSTRAINT "user_warehouse_access_user_id_fkey" TO "WarehouseAccess_userId_fkey";

-- RenameForeignKey
ALTER TABLE "WarehouseAccess" RENAME CONSTRAINT "user_warehouse_access_warehouse_id_fkey" TO "WarehouseAccess_warehouseId_fkey";

-- AddForeignKey
ALTER TABLE "FileAttachment" ADD CONSTRAINT "FileAttachment_stockOpnameId_fkey" FOREIGN KEY ("stockOpnameId") REFERENCES "StockOpname"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockOpname" ADD CONSTRAINT "StockOpname_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockOpname" ADD CONSTRAINT "StockOpname_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockOpnameItem" ADD CONSTRAINT "StockOpnameItem_stockOpnameId_fkey" FOREIGN KEY ("stockOpnameId") REFERENCES "StockOpname"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockOpnameItem" ADD CONSTRAINT "StockOpnameItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockOpnameStack" ADD CONSTRAINT "StockOpnameStack_stockOpnameItemId_fkey" FOREIGN KEY ("stockOpnameItemId") REFERENCES "StockOpnameItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockOpnameStack" ADD CONSTRAINT "StockOpnameStack_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyStockSnapshot" ADD CONSTRAINT "DailyStockSnapshot_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyStockSnapshot" ADD CONSTRAINT "DailyStockSnapshot_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "gate_verification_references_erp_document_id_idx" RENAME TO "GateDocumentReference_erpDocumentId_idx";

-- RenameIndex
ALTER INDEX "gate_verification_references_erp_document_item_id_idx" RENAME TO "GateDocumentReference_erpDocumentItemId_idx";

-- RenameIndex
ALTER INDEX "gate_verification_references_gate_item_id_idx" RENAME TO "GateDocumentReference_gateItemId_idx";

-- RenameIndex
ALTER INDEX "gate_verification_references_gate_verification_id_idx" RENAME TO "GateDocumentReference_gateVerificationId_idx";

-- RenameIndex
ALTER INDEX "gate_verification_references_product_id_idx" RENAME TO "GateDocumentReference_productId_idx";

-- RenameIndex
ALTER INDEX "gate_verification_references_uuid_key" RENAME TO "GateDocumentReference_uuid_key";

-- RenameIndex
ALTER INDEX "erp_document_sync_logs_uuid_idx" RENAME TO "OdooSyncLog_uuid_idx";

-- RenameIndex
ALTER INDEX "erp_document_sync_logs_uuid_key" RENAME TO "OdooSyncLog_uuid_key";

-- RenameIndex
ALTER INDEX "erp_document_sync_logs_warehouse_id_idx" RENAME TO "OdooSyncLog_warehouseId_idx";
