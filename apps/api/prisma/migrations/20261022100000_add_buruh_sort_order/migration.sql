-- AlterTable Buruh: manual display order (Buruh Management page and tanda terima)
-- Additive and idempotent: the backfill only touches rows that have no order yet
ALTER TABLE "Buruh" ADD COLUMN IF NOT EXISTS "sortOrder" INTEGER;

-- Initial order per warehouse follows the previous listing: mandor first, then name
UPDATE "Buruh" AS b
SET "sortOrder" = ranked.rn
FROM (
  SELECT "id",
         ROW_NUMBER() OVER (
           PARTITION BY "warehouseId"
           ORDER BY ("deletedAt" IS NOT NULL), "isMandor" DESC, "name" ASC, "id" ASC
         ) AS rn
  FROM "Buruh"
) AS ranked
WHERE b."id" = ranked."id" AND b."sortOrder" IS NULL;

ALTER TABLE "Buruh" ALTER COLUMN "sortOrder" SET DEFAULT 0;
ALTER TABLE "Buruh" ALTER COLUMN "sortOrder" SET NOT NULL;

CREATE INDEX IF NOT EXISTS "Buruh_warehouseId_sortOrder_idx" ON "Buruh"("warehouseId", "sortOrder");
