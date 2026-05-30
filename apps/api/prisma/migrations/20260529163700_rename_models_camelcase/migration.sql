-- Rename tables from snake_case to PascalCase (matching Prisma model names)

-- 1. Rename erp_document_sync_logs -> OdooSyncLog
ALTER TABLE "erp_document_sync_logs" RENAME TO "OdooSyncLog";

-- Remove old column mappings (rename snake_case columns to camelCase)
ALTER TABLE "OdooSyncLog" RENAME COLUMN "warehouse_id" TO "warehouseId";
ALTER TABLE "OdooSyncLog" RENAME COLUMN "started_at" TO "startedAt";
ALTER TABLE "OdooSyncLog" RENAME COLUMN "finished_at" TO "finishedAt";
ALTER TABLE "OdooSyncLog" RENAME COLUMN "total_documents" TO "totalDocuments";
ALTER TABLE "OdooSyncLog" RENAME COLUMN "processed_documents" TO "processedDocuments";
ALTER TABLE "OdooSyncLog" RENAME COLUMN "error_message" TO "errorMessage";
ALTER TABLE "OdooSyncLog" RENAME COLUMN "created_by" TO "createdBy";

-- 2. Rename user_warehouse_access -> WarehouseAccess
ALTER TABLE "user_warehouse_access" RENAME TO "WarehouseAccess";

-- Remove old column mappings (rename snake_case columns to camelCase)
ALTER TABLE "WarehouseAccess" RENAME COLUMN "user_id" TO "userId";
ALTER TABLE "WarehouseAccess" RENAME COLUMN "warehouse_id" TO "warehouseId";

-- 3. Rename gate_verification_references -> GateDocumentReference
ALTER TABLE "gate_verification_references" RENAME TO "GateDocumentReference";

-- Remove old column mappings (rename snake_case columns to camelCase)
ALTER TABLE "GateDocumentReference" RENAME COLUMN "gate_verification_id" TO "gateVerificationId";
ALTER TABLE "GateDocumentReference" RENAME COLUMN "gate_item_id" TO "gateItemId";
ALTER TABLE "GateDocumentReference" RENAME COLUMN "erp_document_id" TO "erpDocumentId";
ALTER TABLE "GateDocumentReference" RENAME COLUMN "erp_document_item_id" TO "erpDocumentItemId";
ALTER TABLE "GateDocumentReference" RENAME COLUMN "product_id" TO "productId";
ALTER TABLE "GateDocumentReference" RENAME COLUMN "assigned_quantity" TO "assignedQuantity";
ALTER TABLE "GateDocumentReference" RENAME COLUMN "created_at" TO "createdAt";
ALTER TABLE "GateDocumentReference" RENAME COLUMN "created_by" TO "createdBy";

-- 4. Rename enum ErpSyncStatus -> OdooSyncStatus
ALTER TYPE "ErpSyncStatus" RENAME TO "OdooSyncStatus";

-- 5. Add odooProductId column to Product table
ALTER TABLE "Product" ADD COLUMN "odooProductId" INTEGER;
CREATE UNIQUE INDEX "Product_odooProductId_key" ON "Product"("odooProductId");
