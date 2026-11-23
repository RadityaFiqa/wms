-- Peta tumpukan: title and note per stack, row order per area

-- CreateTable
CREATE TABLE "StackMapLabel" (
    "id" SERIAL NOT NULL,
    "warehouseId" INTEGER NOT NULL,
    "locationId" INTEGER NOT NULL,
    "title" TEXT NOT NULL DEFAULT '',
    "note" TEXT NOT NULL DEFAULT '',
    "updatedById" INTEGER,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "StackMapLabel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StackMapArea" (
    "id" SERIAL NOT NULL,
    "warehouseId" INTEGER NOT NULL,
    "area" TEXT NOT NULL,
    "descending" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "StackMapArea_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StackMapLabel_warehouseId_idx" ON "StackMapLabel"("warehouseId");

-- CreateIndex
CREATE UNIQUE INDEX "StackMapLabel_warehouseId_locationId_key" ON "StackMapLabel"("warehouseId", "locationId");

-- CreateIndex
CREATE UNIQUE INDEX "StackMapArea_warehouseId_area_key" ON "StackMapArea"("warehouseId", "area");

-- AddForeignKey
ALTER TABLE "StackMapLabel" ADD CONSTRAINT "StackMapLabel_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StackMapLabel" ADD CONSTRAINT "StackMapLabel_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StackMapLabel" ADD CONSTRAINT "StackMapLabel_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StackMapArea" ADD CONSTRAINT "StackMapArea_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE CASCADE ON UPDATE CASCADE;

