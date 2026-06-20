-- AlterTable: Add new columns to GateOperation
ALTER TABLE "GateOperation" ADD COLUMN "verifiedById" INTEGER,
ADD COLUMN "verifiedAt" TIMESTAMPTZ(3),
ADD COLUMN "verificationNotes" TEXT;

-- AlterTable: Add nullable gateOperationId column to GateDocumentReference
ALTER TABLE "GateDocumentReference" ADD COLUMN "gateOperationId" INTEGER;

-- Data Migration: Copy verification fields from GateVerification to GateOperation
UPDATE "GateOperation" go
SET
  "verifiedById" = gv."verifiedById",
  "verifiedAt" = gv."verifiedAt",
  "verificationNotes" = gv."notes",
  "status" = gv."status"
FROM "GateVerification" gv
WHERE gv."gateOperationId" = go."id";

-- Data Migration: Re-link GateDocumentReference to GateOperation
UPDATE "GateDocumentReference" gdr
SET "gateOperationId" = gv."gateOperationId"
FROM "GateVerification" gv
WHERE gdr."gateVerificationId" = gv."id";

-- Data Migration: Re-link FileAttachment to GateOperation
UPDATE "FileAttachment" fa
SET "gateOperationId" = gv."gateOperationId"
FROM "GateVerification" gv
WHERE fa."gateVerificationId" = gv."id";

-- Make gateOperationId NOT NULL in GateDocumentReference
ALTER TABLE "GateDocumentReference" ALTER COLUMN "gateOperationId" SET NOT NULL;

-- DropForeignKey constraints
ALTER TABLE "FileAttachment" DROP CONSTRAINT "FileAttachment_gateVerificationId_fkey";
ALTER TABLE "GateDocumentReference" DROP CONSTRAINT "GateDocumentReference_gateVerificationId_fkey";
ALTER TABLE "GateVerification" DROP CONSTRAINT "GateVerification_gateOperationId_fkey";
ALTER TABLE "GateVerification" DROP CONSTRAINT "GateVerification_verifiedById_fkey";
ALTER TABLE "GateVerificationProduct" DROP CONSTRAINT "GateVerificationProduct_gateVerificationId_fkey";
ALTER TABLE "GateVerificationProduct" DROP CONSTRAINT "GateVerificationProduct_inventoryId_fkey";
ALTER TABLE "GateVerificationProduct" DROP CONSTRAINT "GateVerificationProduct_locationId_fkey";
ALTER TABLE "GateVerificationProduct" DROP CONSTRAINT "GateVerificationProduct_quantId_fkey";

-- DropIndex
DROP INDEX "GateDocumentReference_gateVerificationId_idx";

-- AlterTable: Drop old columns
ALTER TABLE "FileAttachment" DROP COLUMN "gateVerificationId";
ALTER TABLE "GateDocumentReference" DROP COLUMN "gateVerificationId";
ALTER TABLE "GateOperation" DROP COLUMN "poReferences",
DROP COLUMN "soReferences";

-- DropTable
DROP TABLE "GateVerification";
DROP TABLE "GateVerificationProduct";

-- CreateIndex
CREATE INDEX "GateDocumentReference_gateOperationId_idx" ON "GateDocumentReference"("gateOperationId");

-- AddForeignKey
ALTER TABLE "GateOperation" ADD CONSTRAINT "GateOperation_verifiedById_fkey" FOREIGN KEY ("verifiedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "GateDocumentReference" ADD CONSTRAINT "GateDocumentReference_gateOperationId_fkey" FOREIGN KEY ("gateOperationId") REFERENCES "GateOperation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
