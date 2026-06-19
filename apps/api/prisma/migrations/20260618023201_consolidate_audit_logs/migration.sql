-- AlterTable
ALTER TABLE "AuditLog" ADD COLUMN     "warehouseId" INTEGER;

-- CreateIndex
CREATE INDEX "AuditLog_warehouseId_idx" ON "AuditLog"("warehouseId");

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Migrate existing signatureAuditLog data into AuditLog
INSERT INTO "AuditLog" ("uuid", "actorId", "action", "details", "timestamp")
SELECT 
  gen_random_uuid()::text,
  "userId", 
  "action", 
  jsonb_build_object(
    'documentId', "documentId",
    'metadata', "metadata"
  )::text, 
  "createdAt"
FROM "signatureAuditLog";

-- DropForeignKey
ALTER TABLE "signatureAuditLog" DROP CONSTRAINT "signatureAuditLog_userId_fkey";

-- DropTable
DROP TABLE "signatureAuditLog";
