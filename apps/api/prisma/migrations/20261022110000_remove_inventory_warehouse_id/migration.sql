-- Inventory is a global product catalog; warehouse scoping is done through Quant -> Location
ALTER TABLE "Inventory" DROP CONSTRAINT IF EXISTS "Inventory_warehouseId_fkey";

DROP INDEX IF EXISTS "Inventory_warehouseId_idx";

ALTER TABLE "Inventory" DROP COLUMN IF EXISTS "warehouseId";
