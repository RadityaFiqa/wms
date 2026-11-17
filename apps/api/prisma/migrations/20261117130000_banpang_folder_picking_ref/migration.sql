-- Banpang folders hold kecamatan (picking_ref) + sales order pairs instead of whole sales orders

ALTER TABLE "BanpangFolderItem" ADD COLUMN IF NOT EXISTS "pickingRef" TEXT NOT NULL DEFAULT '';

DROP INDEX IF EXISTS "BanpangFolderItem_warehouseId_soNumber_key";

-- A sales order already in a folder keeps that folder for every kecamatan it delivers to
INSERT INTO "BanpangFolderItem" ("warehouseId", "soNumber", "pickingRef", "folderId", "updatedAt")
SELECT DISTINCT
  i."warehouseId",
  i."soNumber",
  COALESCE(
    NULLIF(
      trim(CASE WHEN jsonb_typeof(d."rawPayload"->'picking_ref') = 'string' THEN d."rawPayload"->>'picking_ref' END),
      ''
    ),
    'Tanpa kecamatan'
  ),
  i."folderId",
  CURRENT_TIMESTAMP
FROM "BanpangFolderItem" i
JOIN "DocumentReference" d
  ON d."warehouseId" = i."warehouseId"
 AND trim(d."origin") = i."soNumber"
 AND d."pickingTypeCode" = 'outgoing'
WHERE i."pickingRef" = '';

DELETE FROM "BanpangFolderItem" WHERE "pickingRef" = '';

ALTER TABLE "BanpangFolderItem" ALTER COLUMN "pickingRef" DROP DEFAULT;

CREATE UNIQUE INDEX IF NOT EXISTS "BanpangFolderItem_warehouseId_soNumber_pickingRef_key" ON "BanpangFolderItem"("warehouseId", "soNumber", "pickingRef");
