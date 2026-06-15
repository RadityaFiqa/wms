-- AlterTable
ALTER TABLE "GateOperationProduct" ADD COLUMN     "locationId" INTEGER,
ADD COLUMN     "quantId" INTEGER;

-- AlterTable
ALTER TABLE "GateVerificationProduct" ADD COLUMN     "locationId" INTEGER,
ADD COLUMN     "quantId" INTEGER;

-- CreateIndex
CREATE INDEX "GateOperationProduct_quantId_idx" ON "GateOperationProduct"("quantId");

-- CreateIndex
CREATE INDEX "GateOperationProduct_locationId_idx" ON "GateOperationProduct"("locationId");

-- CreateIndex
CREATE INDEX "GateVerificationProduct_quantId_idx" ON "GateVerificationProduct"("quantId");

-- CreateIndex
CREATE INDEX "GateVerificationProduct_locationId_idx" ON "GateVerificationProduct"("locationId");

-- AddForeignKey
ALTER TABLE "GateOperationProduct" ADD CONSTRAINT "GateOperationProduct_quantId_fkey" FOREIGN KEY ("quantId") REFERENCES "Quant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GateOperationProduct" ADD CONSTRAINT "GateOperationProduct_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GateVerificationProduct" ADD CONSTRAINT "GateVerificationProduct_quantId_fkey" FOREIGN KEY ("quantId") REFERENCES "Quant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GateVerificationProduct" ADD CONSTRAINT "GateVerificationProduct_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE SET NULL ON UPDATE CASCADE;
