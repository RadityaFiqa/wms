-- CreateEnum
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'TagihanType') THEN
        CREATE TYPE "TagihanType" AS ENUM ('LOADING', 'UNLOADING', 'REBAGGING', 'REPROSES', 'OVERSTAPEL');
    END IF;
END $$;

-- CreateTable: MasterTagihanStatus
CREATE TABLE IF NOT EXISTS "MasterTagihanStatus" (
    "id" SERIAL NOT NULL,
    "uuid" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "color" TEXT DEFAULT 'blue',
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MasterTagihanStatus_pkey" PRIMARY KEY ("id")
);

-- CreateTable: Tagihan
CREATE TABLE IF NOT EXISTS "Tagihan" (
    "id" SERIAL NOT NULL,
    "uuid" TEXT NOT NULL,
    "warehouseId" INTEGER NOT NULL,
    "documentNumber" TEXT NOT NULL,
    "type" "TagihanType" NOT NULL,
    "statusId" INTEGER,
    "totalAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "notes" TEXT,
    "tagihanDate" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" INTEGER,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Tagihan_pkey" PRIMARY KEY ("id")
);

-- CreateTable: TagihanDocumentReference
CREATE TABLE IF NOT EXISTS "TagihanDocumentReference" (
    "id" SERIAL NOT NULL,
    "uuid" TEXT NOT NULL,
    "tagihanId" INTEGER NOT NULL,
    "documentReferenceId" INTEGER NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TagihanDocumentReference_pkey" PRIMARY KEY ("id")
);

-- CreateTable: TagihanNonCommodityDocument
CREATE TABLE IF NOT EXISTS "TagihanNonCommodityDocument" (
    "id" SERIAL NOT NULL,
    "uuid" TEXT NOT NULL,
    "tagihanId" INTEGER NOT NULL,
    "documentPurchaseOrderId" INTEGER NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TagihanNonCommodityDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable: TagihanManualDocument
CREATE TABLE IF NOT EXISTS "TagihanManualDocument" (
    "id" SERIAL NOT NULL,
    "uuid" TEXT NOT NULL,
    "tagihanId" INTEGER NOT NULL,
    "documentNumber" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TagihanManualDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable: TagihanSummary
CREATE TABLE IF NOT EXISTS "TagihanSummary" (
    "id" SERIAL NOT NULL,
    "uuid" TEXT NOT NULL,
    "tagihanId" INTEGER NOT NULL,
    "documentType" TEXT NOT NULL,
    "uom" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "costPerUnit" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "subtotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TagihanSummary_pkey" PRIMARY KEY ("id")
);

-- CreateTable: TagihanFile
CREATE TABLE IF NOT EXISTS "TagihanFile" (
    "id" SERIAL NOT NULL,
    "uuid" TEXT NOT NULL,
    "tagihanId" INTEGER NOT NULL,
    "filePath" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "mimeType" TEXT NOT NULL,
    "uploadedById" INTEGER,
    "uploadedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TagihanFile_pkey" PRIMARY KEY ("id")
);

-- CreateIndexes
CREATE UNIQUE INDEX IF NOT EXISTS "MasterTagihanStatus_uuid_key" ON "MasterTagihanStatus"("uuid");
CREATE UNIQUE INDEX IF NOT EXISTS "MasterTagihanStatus_name_key" ON "MasterTagihanStatus"("name");

CREATE UNIQUE INDEX IF NOT EXISTS "Tagihan_uuid_key" ON "Tagihan"("uuid");
CREATE UNIQUE INDEX IF NOT EXISTS "Tagihan_documentNumber_key" ON "Tagihan"("documentNumber");
CREATE INDEX IF NOT EXISTS "Tagihan_warehouseId_idx" ON "Tagihan"("warehouseId");
CREATE INDEX IF NOT EXISTS "Tagihan_uuid_idx" ON "Tagihan"("uuid");
CREATE INDEX IF NOT EXISTS "Tagihan_documentNumber_idx" ON "Tagihan"("documentNumber");
CREATE INDEX IF NOT EXISTS "Tagihan_type_idx" ON "Tagihan"("type");
CREATE INDEX IF NOT EXISTS "Tagihan_statusId_idx" ON "Tagihan"("statusId");
CREATE INDEX IF NOT EXISTS "Tagihan_tagihanDate_idx" ON "Tagihan"("tagihanDate");

CREATE UNIQUE INDEX IF NOT EXISTS "TagihanDocumentReference_uuid_key" ON "TagihanDocumentReference"("uuid");
CREATE INDEX IF NOT EXISTS "TagihanDocumentReference_tagihanId_idx" ON "TagihanDocumentReference"("tagihanId");
CREATE INDEX IF NOT EXISTS "TagihanDocumentReference_documentReferenceId_idx" ON "TagihanDocumentReference"("documentReferenceId");
CREATE UNIQUE INDEX IF NOT EXISTS "TagihanDocumentReference_tagihanId_documentReferenceId_key" ON "TagihanDocumentReference"("tagihanId", "documentReferenceId");

CREATE UNIQUE INDEX IF NOT EXISTS "TagihanNonCommodityDocument_uuid_key" ON "TagihanNonCommodityDocument"("uuid");
CREATE INDEX IF NOT EXISTS "TagihanNonCommodityDocument_tagihanId_idx" ON "TagihanNonCommodityDocument"("tagihanId");
CREATE INDEX IF NOT EXISTS "TagihanNonCommodityDocument_documentPurchaseOrderId_idx" ON "TagihanNonCommodityDocument"("documentPurchaseOrderId");
CREATE UNIQUE INDEX IF NOT EXISTS "TagihanNonCommodityDocument_tagihanId_documentPurchaseOrder_key" ON "TagihanNonCommodityDocument"("tagihanId", "documentPurchaseOrderId");

CREATE UNIQUE INDEX IF NOT EXISTS "TagihanManualDocument_uuid_key" ON "TagihanManualDocument"("uuid");
CREATE INDEX IF NOT EXISTS "TagihanManualDocument_tagihanId_idx" ON "TagihanManualDocument"("tagihanId");
CREATE INDEX IF NOT EXISTS "TagihanManualDocument_documentNumber_idx" ON "TagihanManualDocument"("documentNumber");

CREATE UNIQUE INDEX IF NOT EXISTS "TagihanSummary_uuid_key" ON "TagihanSummary"("uuid");
CREATE INDEX IF NOT EXISTS "TagihanSummary_tagihanId_idx" ON "TagihanSummary"("tagihanId");

CREATE UNIQUE INDEX IF NOT EXISTS "TagihanFile_uuid_key" ON "TagihanFile"("uuid");
CREATE INDEX IF NOT EXISTS "TagihanFile_tagihanId_idx" ON "TagihanFile"("tagihanId");
CREATE INDEX IF NOT EXISTS "TagihanFile_uuid_idx" ON "TagihanFile"("uuid");

-- AddForeignKeys safely
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Tagihan_warehouseId_fkey') THEN
        ALTER TABLE "Tagihan" ADD CONSTRAINT "Tagihan_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Tagihan_statusId_fkey') THEN
        ALTER TABLE "Tagihan" ADD CONSTRAINT "Tagihan_statusId_fkey" FOREIGN KEY ("statusId") REFERENCES "MasterTagihanStatus"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Tagihan_createdById_fkey') THEN
        ALTER TABLE "Tagihan" ADD CONSTRAINT "Tagihan_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'TagihanDocumentReference_tagihanId_fkey') THEN
        ALTER TABLE "TagihanDocumentReference" ADD CONSTRAINT "TagihanDocumentReference_tagihanId_fkey" FOREIGN KEY ("tagihanId") REFERENCES "Tagihan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'TagihanDocumentReference_documentReferenceId_fkey') THEN
        ALTER TABLE "TagihanDocumentReference" ADD CONSTRAINT "TagihanDocumentReference_documentReferenceId_fkey" FOREIGN KEY ("documentReferenceId") REFERENCES "DocumentReference"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'TagihanNonCommodityDocument_tagihanId_fkey') THEN
        ALTER TABLE "TagihanNonCommodityDocument" ADD CONSTRAINT "TagihanNonCommodityDocument_tagihanId_fkey" FOREIGN KEY ("tagihanId") REFERENCES "Tagihan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'TagihanNonCommodityDocument_documentPurchaseOrderId_fkey') THEN
        ALTER TABLE "TagihanNonCommodityDocument" ADD CONSTRAINT "TagihanNonCommodityDocument_documentPurchaseOrderId_fkey" FOREIGN KEY ("documentPurchaseOrderId") REFERENCES "DocumentPurchaseOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'TagihanManualDocument_tagihanId_fkey') THEN
        ALTER TABLE "TagihanManualDocument" ADD CONSTRAINT "TagihanManualDocument_tagihanId_fkey" FOREIGN KEY ("tagihanId") REFERENCES "Tagihan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'TagihanSummary_tagihanId_fkey') THEN
        ALTER TABLE "TagihanSummary" ADD CONSTRAINT "TagihanSummary_tagihanId_fkey" FOREIGN KEY ("tagihanId") REFERENCES "Tagihan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'TagihanFile_tagihanId_fkey') THEN
        ALTER TABLE "TagihanFile" ADD CONSTRAINT "TagihanFile_tagihanId_fkey" FOREIGN KEY ("tagihanId") REFERENCES "Tagihan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'TagihanFile_uploadedById_fkey') THEN
        ALTER TABLE "TagihanFile" ADD CONSTRAINT "TagihanFile_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;
