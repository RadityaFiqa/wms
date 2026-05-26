-- CreateTable
CREATE TABLE "OdooAccount" (
    "id" SERIAL NOT NULL,
    "uuid" TEXT NOT NULL,
    "warehouseId" INTEGER NOT NULL,
    "baseUrl" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "encryptedPassword" TEXT NOT NULL,
    "sessionId" TEXT,
    "csrfToken" TEXT,
    "sessionExpiredAt" TIMESTAMP(3),
    "lastLoginAt" TIMESTAMP(3),
    "lastRefreshAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OdooAccount_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OdooAccount_uuid_key" ON "OdooAccount"("uuid");

-- CreateIndex
CREATE UNIQUE INDEX "OdooAccount_warehouseId_key" ON "OdooAccount"("warehouseId");

-- CreateIndex
CREATE INDEX "OdooAccount_warehouseId_idx" ON "OdooAccount"("warehouseId");

-- CreateIndex
CREATE INDEX "OdooAccount_uuid_idx" ON "OdooAccount"("uuid");

-- AddForeignKey
ALTER TABLE "OdooAccount" ADD CONSTRAINT "OdooAccount_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE CASCADE ON UPDATE CASCADE;
