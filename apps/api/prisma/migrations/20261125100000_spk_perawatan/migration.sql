-- CreateTable
CREATE TABLE "SpkPerawatan" (
    "id" SERIAL NOT NULL,
    "uuid" TEXT NOT NULL,
    "warehouseId" INTEGER NOT NULL,
    "odooId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "state" TEXT,
    "date" TIMESTAMPTZ(3),
    "weeklyName" TEXT,
    "locationName" TEXT,
    "namaSuratPemohon" TEXT,
    "jabatanPihakPertama" TEXT,
    "treatmentTypes" TEXT[],
    "typeSpraying" TEXT,
    "typeFumigasi" TEXT,
    "typeFogging" TEXT,
    "syncedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "SpkPerawatan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SpkPerawatanLine" (
    "id" SERIAL NOT NULL,
    "spkPerawatanId" INTEGER NOT NULL,
    "productName" TEXT NOT NULL,
    "lotName" TEXT,
    "jumlahStock" DOUBLE PRECISION,

    CONSTRAINT "SpkPerawatanLine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SpkPerawatan_uuid_key" ON "SpkPerawatan"("uuid");

-- CreateIndex
CREATE INDEX "SpkPerawatan_warehouseId_date_idx" ON "SpkPerawatan"("warehouseId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "SpkPerawatan_warehouseId_odooId_key" ON "SpkPerawatan"("warehouseId", "odooId");

-- CreateIndex
CREATE INDEX "SpkPerawatanLine_spkPerawatanId_idx" ON "SpkPerawatanLine"("spkPerawatanId");

-- CreateIndex
CREATE INDEX "SpkPerawatanLine_lotName_idx" ON "SpkPerawatanLine"("lotName");

-- AddForeignKey
ALTER TABLE "SpkPerawatan" ADD CONSTRAINT "SpkPerawatan_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpkPerawatanLine" ADD CONSTRAINT "SpkPerawatanLine_spkPerawatanId_fkey" FOREIGN KEY ("spkPerawatanId") REFERENCES "SpkPerawatan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
