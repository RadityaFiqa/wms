-- CreateTable
CREATE TABLE IF NOT EXISTS "GateOperationDocumentReference" (
    "id" SERIAL NOT NULL,
    "uuid" TEXT NOT NULL,
    "gateOperationId" INTEGER NOT NULL,
    "documentReferenceId" INTEGER NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GateOperationDocumentReference_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "GateOperationProduct" ADD COLUMN IF NOT EXISTS "documentReferenceId" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "GateOperationDocumentReference_uuid_key" ON "GateOperationDocumentReference"("uuid");
CREATE INDEX IF NOT EXISTS "GateOperationDocumentReference_gateOperationId_idx" ON "GateOperationDocumentReference"("gateOperationId");
CREATE INDEX IF NOT EXISTS "GateOperationDocumentReference_documentReferenceId_idx" ON "GateOperationDocumentReference"("documentReferenceId");
CREATE UNIQUE INDEX IF NOT EXISTS "GateOperationDocumentReference_gateOperationId_documentReferenceId_key" ON "GateOperationDocumentReference"("gateOperationId", "documentReferenceId");
CREATE INDEX IF NOT EXISTS "GateOperationProduct_documentReferenceId_idx" ON "GateOperationProduct"("documentReferenceId");

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'GateOperationDocumentReference_gateOperationId_fkey'
    ) THEN
        ALTER TABLE "GateOperationDocumentReference" ADD CONSTRAINT "GateOperationDocumentReference_gateOperationId_fkey" FOREIGN KEY ("gateOperationId") REFERENCES "GateOperation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'GateOperationDocumentReference_documentReferenceId_fkey'
    ) THEN
        ALTER TABLE "GateOperationDocumentReference" ADD CONSTRAINT "GateOperationDocumentReference_documentReferenceId_fkey" FOREIGN KEY ("documentReferenceId") REFERENCES "DocumentReference"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'GateOperationProduct_documentReferenceId_fkey'
    ) THEN
        ALTER TABLE "GateOperationProduct" ADD CONSTRAINT "GateOperationProduct_documentReferenceId_fkey" FOREIGN KEY ("documentReferenceId") REFERENCES "DocumentReference"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

-- Data Migration (Safe & Idempotent Backfill):
-- 1. Backfill junction table from existing GateOperation records
INSERT INTO "GateOperationDocumentReference" ("uuid", "gateOperationId", "documentReferenceId", "createdAt", "updatedAt")
SELECT
    gen_random_uuid()::text,
    go."id",
    go."documentReferenceId",
    go."createdAt",
    go."updatedAt"
FROM "GateOperation" go
WHERE go."documentReferenceId" IS NOT NULL
ON CONFLICT ("gateOperationId", "documentReferenceId") DO NOTHING;

-- 2. Backfill GateOperationProduct.documentReferenceId from GateOperation.documentReferenceId
UPDATE "GateOperationProduct" gop
SET "documentReferenceId" = go."documentReferenceId"
FROM "GateOperation" go
WHERE gop."gateOperationId" = go."id"
  AND go."documentReferenceId" IS NOT NULL
  AND gop."documentReferenceId" IS NULL;
