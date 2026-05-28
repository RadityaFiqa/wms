-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "uom" TEXT;

-- CreateTable
CREATE TABLE "Location" (
    "id" SERIAL NOT NULL,
    "uuid" TEXT NOT NULL,
    "odooLocationId" INTEGER NOT NULL,
    "displayName" TEXT NOT NULL,
    "warehouseId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Location_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Quant" (
    "id" SERIAL NOT NULL,
    "uuid" TEXT NOT NULL,
    "odooQuantId" INTEGER NOT NULL,
    "productId" INTEGER NOT NULL,
    "locationId" INTEGER NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "reservedQuantity" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "availableQuantity" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "secondaryUnitQty" DOUBLE PRECISION DEFAULT 0,
    "lotName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Quant_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Location_uuid_key" ON "Location"("uuid");

-- CreateIndex
CREATE INDEX "Location_warehouseId_idx" ON "Location"("warehouseId");

-- CreateIndex
CREATE UNIQUE INDEX "Location_warehouseId_odooLocationId_key" ON "Location"("warehouseId", "odooLocationId");

-- CreateIndex
CREATE UNIQUE INDEX "Quant_uuid_key" ON "Quant"("uuid");

-- CreateIndex
CREATE UNIQUE INDEX "Quant_odooQuantId_key" ON "Quant"("odooQuantId");

-- CreateIndex
CREATE INDEX "Quant_productId_idx" ON "Quant"("productId");

-- CreateIndex
CREATE INDEX "Quant_locationId_idx" ON "Quant"("locationId");

-- AddForeignKey
ALTER TABLE "Location" ADD CONSTRAINT "Location_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quant" ADD CONSTRAINT "Quant_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quant" ADD CONSTRAINT "Quant_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE CASCADE ON UPDATE CASCADE;
