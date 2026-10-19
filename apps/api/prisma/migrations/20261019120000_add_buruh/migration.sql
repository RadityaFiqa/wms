-- CreateTable Buruh: warehouse-scoped labor master with private KTP photo key
CREATE TABLE "Buruh" (
    "id" SERIAL NOT NULL,
    "uuid" TEXT NOT NULL,
    "warehouseId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "nik" TEXT,
    "ktpPhotoKey" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdById" INTEGER,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "deletedAt" TIMESTAMPTZ(3),

    CONSTRAINT "Buruh_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Buruh_uuid_key" ON "Buruh"("uuid");
CREATE INDEX "Buruh_warehouseId_idx" ON "Buruh"("warehouseId");
CREATE INDEX "Buruh_uuid_idx" ON "Buruh"("uuid");
CREATE INDEX "Buruh_name_idx" ON "Buruh"("name");
CREATE INDEX "Buruh_isActive_idx" ON "Buruh"("isActive");

ALTER TABLE "Buruh" ADD CONSTRAINT "Buruh_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Buruh" ADD CONSTRAINT "Buruh_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
