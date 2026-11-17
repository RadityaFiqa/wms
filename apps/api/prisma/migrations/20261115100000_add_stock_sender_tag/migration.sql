-- CreateTable StockSenderTag: manual labels on senders in the stock inbound grouping
CREATE TABLE IF NOT EXISTS "StockSenderTag" (
    "id" SERIAL NOT NULL,
    "uuid" TEXT NOT NULL,
    "warehouseId" INTEGER NOT NULL,
    "senderName" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "createdById" INTEGER,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StockSenderTag_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "StockSenderTag_uuid_key" ON "StockSenderTag"("uuid");
CREATE UNIQUE INDEX IF NOT EXISTS "StockSenderTag_warehouseId_senderName_label_key" ON "StockSenderTag"("warehouseId", "senderName", "label");
CREATE INDEX IF NOT EXISTS "StockSenderTag_warehouseId_senderName_idx" ON "StockSenderTag"("warehouseId", "senderName");

ALTER TABLE "StockSenderTag" ADD CONSTRAINT "StockSenderTag_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StockSenderTag" ADD CONSTRAINT "StockSenderTag_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
