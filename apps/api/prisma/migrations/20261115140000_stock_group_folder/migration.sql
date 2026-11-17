-- Stock inbound grouping: manual folders per product replace the sender tags

CREATE TABLE IF NOT EXISTS "StockGroupFolder" (
    "id" SERIAL NOT NULL,
    "uuid" TEXT NOT NULL,
    "warehouseId" INTEGER NOT NULL,
    "inventoryId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdById" INTEGER,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "StockGroupFolder_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "StockGroupFolder_uuid_key" ON "StockGroupFolder"("uuid");
CREATE UNIQUE INDEX IF NOT EXISTS "StockGroupFolder_warehouseId_inventoryId_name_key" ON "StockGroupFolder"("warehouseId", "inventoryId", "name");
CREATE INDEX IF NOT EXISTS "StockGroupFolder_warehouseId_inventoryId_idx" ON "StockGroupFolder"("warehouseId", "inventoryId");

ALTER TABLE "StockGroupFolder" ADD CONSTRAINT "StockGroupFolder_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StockGroupFolder" ADD CONSTRAINT "StockGroupFolder_inventoryId_fkey" FOREIGN KEY ("inventoryId") REFERENCES "Inventory"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StockGroupFolder" ADD CONSTRAINT "StockGroupFolder_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "StockGroupFolderItem" (
    "id" SERIAL NOT NULL,
    "warehouseId" INTEGER NOT NULL,
    "inventoryId" INTEGER NOT NULL,
    "senderName" TEXT NOT NULL,
    "lotName" TEXT NOT NULL DEFAULT '',
    "folderId" INTEGER,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "StockGroupFolderItem_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "StockGroupFolderItem_warehouseId_inventoryId_senderName_lotName_key" ON "StockGroupFolderItem"("warehouseId", "inventoryId", "senderName", "lotName");
CREATE INDEX IF NOT EXISTS "StockGroupFolderItem_warehouseId_inventoryId_idx" ON "StockGroupFolderItem"("warehouseId", "inventoryId");
CREATE INDEX IF NOT EXISTS "StockGroupFolderItem_folderId_idx" ON "StockGroupFolderItem"("folderId");

ALTER TABLE "StockGroupFolderItem" ADD CONSTRAINT "StockGroupFolderItem_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StockGroupFolderItem" ADD CONSTRAINT "StockGroupFolderItem_inventoryId_fkey" FOREIGN KEY ("inventoryId") REFERENCES "Inventory"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StockGroupFolderItem" ADD CONSTRAINT "StockGroupFolderItem_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "StockGroupFolder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Existing sender tags become folders on the product they were added on, holding that sender
DO $$
BEGIN
  IF to_regclass('public."StockSenderTag"') IS NOT NULL THEN
    CREATE TEMP TABLE tag_product ON COMMIT DROP AS
    SELECT t."warehouseId", t."senderName", t."label", t."createdById", t."createdAt", i."id" AS "inventoryId"
    FROM "StockSenderTag" t
    JOIN "Inventory" i ON i."sku" = CASE
      WHEN t."label" IN ('HGL KALSEL', 'HGL JATIM') THEN 'B0010193Z'
      WHEN t."label" = 'RETUR BANPANG' THEN 'B0010152Z'
    END;

    INSERT INTO "StockGroupFolder" ("uuid", "warehouseId", "inventoryId", "name", "sortOrder", "createdById", "createdAt", "updatedAt")
    SELECT gen_random_uuid()::text, "warehouseId", "inventoryId", "label",
           (ROW_NUMBER() OVER (PARTITION BY "warehouseId", "inventoryId" ORDER BY MIN("createdAt")))::int,
           MIN("createdById"), MIN("createdAt"), CURRENT_TIMESTAMP
    FROM tag_product
    GROUP BY "warehouseId", "inventoryId", "label"
    ON CONFLICT DO NOTHING;

    INSERT INTO "StockGroupFolderItem" ("warehouseId", "inventoryId", "senderName", "lotName", "folderId", "updatedAt")
    SELECT tp."warehouseId", tp."inventoryId", tp."senderName", '', f."id", CURRENT_TIMESTAMP
    FROM tag_product tp
    JOIN "StockGroupFolder" f
      ON f."warehouseId" = tp."warehouseId" AND f."inventoryId" = tp."inventoryId" AND f."name" = tp."label"
    ON CONFLICT DO NOTHING;

    DROP TABLE "StockSenderTag";
  END IF;
END $$;
