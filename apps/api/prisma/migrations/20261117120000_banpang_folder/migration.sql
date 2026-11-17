-- Banpang realization: manual folders grouping sales orders, per warehouse

-- CreateTable
CREATE TABLE "BanpangFolder" (
    "id" SERIAL NOT NULL,
    "uuid" TEXT NOT NULL,
    "warehouseId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdById" INTEGER,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "BanpangFolder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BanpangFolderItem" (
    "id" SERIAL NOT NULL,
    "warehouseId" INTEGER NOT NULL,
    "soNumber" TEXT NOT NULL,
    "folderId" INTEGER NOT NULL,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "BanpangFolderItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BanpangFolder_uuid_key" ON "BanpangFolder"("uuid");

-- CreateIndex
CREATE INDEX "BanpangFolder_warehouseId_idx" ON "BanpangFolder"("warehouseId");

-- CreateIndex
CREATE UNIQUE INDEX "BanpangFolder_warehouseId_name_key" ON "BanpangFolder"("warehouseId", "name");

-- CreateIndex
CREATE INDEX "BanpangFolderItem_folderId_idx" ON "BanpangFolderItem"("folderId");

-- CreateIndex
CREATE UNIQUE INDEX "BanpangFolderItem_warehouseId_soNumber_key" ON "BanpangFolderItem"("warehouseId", "soNumber");

-- AddForeignKey
ALTER TABLE "BanpangFolder" ADD CONSTRAINT "BanpangFolder_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BanpangFolder" ADD CONSTRAINT "BanpangFolder_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BanpangFolderItem" ADD CONSTRAINT "BanpangFolderItem_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BanpangFolderItem" ADD CONSTRAINT "BanpangFolderItem_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "BanpangFolder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

