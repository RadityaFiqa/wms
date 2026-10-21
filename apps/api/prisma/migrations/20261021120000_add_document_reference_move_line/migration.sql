-- Additive only: new table holding effective Odoo move lines (real stack source/destination from WMS Picking)
CREATE TABLE IF NOT EXISTS "DocumentReferenceMoveLine" (
    "id" SERIAL NOT NULL,
    "uuid" TEXT NOT NULL,
    "erpMoveLineId" INTEGER NOT NULL,
    "documentReferenceId" INTEGER NOT NULL,
    "documentReferenceItemId" INTEGER NOT NULL,
    "inventoryId" INTEGER NOT NULL,
    "pickingName" TEXT,
    "sourceLocationId" INTEGER,
    "sourceLocationName" TEXT,
    "destinationLocationId" INTEGER,
    "destinationLocationName" TEXT,
    "lotName" TEXT,
    "quantity" DOUBLE PRECISION NOT NULL,
    "date" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "DocumentReferenceMoveLine_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "DocumentReferenceMoveLine_uuid_key" ON "DocumentReferenceMoveLine"("uuid");
CREATE INDEX IF NOT EXISTS "DocumentReferenceMoveLine_documentReferenceId_idx" ON "DocumentReferenceMoveLine"("documentReferenceId");
CREATE INDEX IF NOT EXISTS "DocumentReferenceMoveLine_inventoryId_idx" ON "DocumentReferenceMoveLine"("inventoryId");
CREATE INDEX IF NOT EXISTS "DocumentReferenceMoveLine_sourceLocationId_idx" ON "DocumentReferenceMoveLine"("sourceLocationId");
CREATE INDEX IF NOT EXISTS "DocumentReferenceMoveLine_destinationLocationId_idx" ON "DocumentReferenceMoveLine"("destinationLocationId");

ALTER TABLE "DocumentReferenceMoveLine" ADD CONSTRAINT "DocumentReferenceMoveLine_documentReferenceId_fkey" FOREIGN KEY ("documentReferenceId") REFERENCES "DocumentReference"("id") ON DELETE CASCADE ON UPDATE CASCADE;
