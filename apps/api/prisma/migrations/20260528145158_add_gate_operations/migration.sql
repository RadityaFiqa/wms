-- CreateEnum
CREATE TYPE "CardType" AS ENUM ('IN', 'OUT');

-- CreateEnum
CREATE TYPE "VerificationStatus" AS ENUM ('PENDING', 'VERIFIED', 'REJECTED');

-- CreateTable
CREATE TABLE "FileAttachment" (
    "id" SERIAL NOT NULL,
    "uuid" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "uploadedById" INTEGER NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FileAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GateOperation" (
    "id" SERIAL NOT NULL,
    "uuid" TEXT NOT NULL,
    "opNumber" TEXT NOT NULL,
    "cardType" "CardType" NOT NULL,
    "vehiclePhotoId" INTEGER,
    "driverName" TEXT NOT NULL,
    "licensePlate" TEXT NOT NULL,
    "notes" TEXT,
    "status" "VerificationStatus" NOT NULL DEFAULT 'PENDING',
    "warehouseId" INTEGER NOT NULL,
    "createdByUserId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GateOperation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GateOperationProduct" (
    "id" SERIAL NOT NULL,
    "uuid" TEXT NOT NULL,
    "gateOperationId" INTEGER NOT NULL,
    "productId" INTEGER NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "GateOperationProduct_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GateVerification" (
    "id" SERIAL NOT NULL,
    "uuid" TEXT NOT NULL,
    "gateOperationId" INTEGER NOT NULL,
    "verifiedById" INTEGER NOT NULL,
    "verifiedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "VerificationStatus" NOT NULL DEFAULT 'VERIFIED',
    "notes" TEXT,
    "attachmentId" INTEGER,

    CONSTRAINT "GateVerification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GateVerificationProduct" (
    "id" SERIAL NOT NULL,
    "uuid" TEXT NOT NULL,
    "gateVerificationId" INTEGER NOT NULL,
    "productId" INTEGER NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "GateVerificationProduct_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FileAttachment_uuid_key" ON "FileAttachment"("uuid");

-- CreateIndex
CREATE UNIQUE INDEX "GateOperation_uuid_key" ON "GateOperation"("uuid");

-- CreateIndex
CREATE UNIQUE INDEX "GateOperation_opNumber_key" ON "GateOperation"("opNumber");

-- CreateIndex
CREATE UNIQUE INDEX "GateOperation_vehiclePhotoId_key" ON "GateOperation"("vehiclePhotoId");

-- CreateIndex
CREATE INDEX "GateOperation_uuid_idx" ON "GateOperation"("uuid");

-- CreateIndex
CREATE INDEX "GateOperation_opNumber_idx" ON "GateOperation"("opNumber");

-- CreateIndex
CREATE INDEX "GateOperation_warehouseId_idx" ON "GateOperation"("warehouseId");

-- CreateIndex
CREATE INDEX "GateOperation_status_idx" ON "GateOperation"("status");

-- CreateIndex
CREATE UNIQUE INDEX "GateOperationProduct_uuid_key" ON "GateOperationProduct"("uuid");

-- CreateIndex
CREATE INDEX "GateOperationProduct_gateOperationId_idx" ON "GateOperationProduct"("gateOperationId");

-- CreateIndex
CREATE INDEX "GateOperationProduct_productId_idx" ON "GateOperationProduct"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "GateVerification_uuid_key" ON "GateVerification"("uuid");

-- CreateIndex
CREATE UNIQUE INDEX "GateVerification_gateOperationId_key" ON "GateVerification"("gateOperationId");

-- CreateIndex
CREATE UNIQUE INDEX "GateVerification_attachmentId_key" ON "GateVerification"("attachmentId");

-- CreateIndex
CREATE INDEX "GateVerification_uuid_idx" ON "GateVerification"("uuid");

-- CreateIndex
CREATE INDEX "GateVerification_gateOperationId_idx" ON "GateVerification"("gateOperationId");

-- CreateIndex
CREATE UNIQUE INDEX "GateVerificationProduct_uuid_key" ON "GateVerificationProduct"("uuid");

-- CreateIndex
CREATE INDEX "GateVerificationProduct_gateVerificationId_idx" ON "GateVerificationProduct"("gateVerificationId");

-- CreateIndex
CREATE INDEX "GateVerificationProduct_productId_idx" ON "GateVerificationProduct"("productId");

-- AddForeignKey
ALTER TABLE "FileAttachment" ADD CONSTRAINT "FileAttachment_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GateOperation" ADD CONSTRAINT "GateOperation_vehiclePhotoId_fkey" FOREIGN KEY ("vehiclePhotoId") REFERENCES "FileAttachment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GateOperation" ADD CONSTRAINT "GateOperation_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GateOperation" ADD CONSTRAINT "GateOperation_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GateOperationProduct" ADD CONSTRAINT "GateOperationProduct_gateOperationId_fkey" FOREIGN KEY ("gateOperationId") REFERENCES "GateOperation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GateOperationProduct" ADD CONSTRAINT "GateOperationProduct_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GateVerification" ADD CONSTRAINT "GateVerification_gateOperationId_fkey" FOREIGN KEY ("gateOperationId") REFERENCES "GateOperation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GateVerification" ADD CONSTRAINT "GateVerification_verifiedById_fkey" FOREIGN KEY ("verifiedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GateVerification" ADD CONSTRAINT "GateVerification_attachmentId_fkey" FOREIGN KEY ("attachmentId") REFERENCES "FileAttachment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GateVerificationProduct" ADD CONSTRAINT "GateVerificationProduct_gateVerificationId_fkey" FOREIGN KEY ("gateVerificationId") REFERENCES "GateVerification"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GateVerificationProduct" ADD CONSTRAINT "GateVerificationProduct_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
