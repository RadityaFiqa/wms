-- 1. Drop the old leaf Inventory table and its constraints
DROP TABLE IF EXISTS "Inventory" CASCADE;

-- 2. Rename Product table to Inventory
ALTER TABLE "Product" RENAME TO "Inventory";

-- 3. Update primary key and index names on renamed table
ALTER TABLE "Inventory" RENAME CONSTRAINT "Product_pkey" TO "Inventory_pkey";
ALTER INDEX IF EXISTS "Product_pkey" RENAME TO "Inventory_pkey";
ALTER INDEX IF EXISTS "Product_sku_key" RENAME TO "Inventory_sku_key";
ALTER INDEX IF EXISTS "Product_uuid_key" RENAME TO "Inventory_uuid_key";
ALTER INDEX IF EXISTS "Product_uuid_idx" RENAME TO "Inventory_uuid_idx";
ALTER INDEX IF EXISTS "Product_sku_idx" RENAME TO "Inventory_sku_idx";

-- 4. Drop columns description, price, category from new Inventory table
ALTER TABLE "Inventory" DROP COLUMN IF EXISTS "description";
ALTER TABLE "Inventory" DROP COLUMN IF EXISTS "price";
ALTER TABLE "Inventory" DROP COLUMN IF EXISTS "category";

-- 5. In Quant table, rename column productId to inventoryId and update foreign key and indexes
ALTER TABLE "Quant" RENAME COLUMN "productId" TO "inventoryId";
ALTER TABLE "Quant" DROP CONSTRAINT IF EXISTS "Quant_productId_fkey";
ALTER TABLE "Quant" ADD CONSTRAINT "Quant_inventoryId_fkey" FOREIGN KEY ("inventoryId") REFERENCES "Inventory"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER INDEX IF EXISTS "Quant_productId_idx" RENAME TO "Quant_inventoryId_idx";

-- 6. In OrderItem table, rename column productId to inventoryId and update foreign key
ALTER TABLE "OrderItem" RENAME COLUMN "productId" TO "inventoryId";
ALTER TABLE "OrderItem" DROP CONSTRAINT IF EXISTS "OrderItem_productId_fkey";
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_inventoryId_fkey" FOREIGN KEY ("inventoryId") REFERENCES "Inventory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 7. In GateOperationProduct table, rename column productId to inventoryId and update foreign key and indexes
ALTER TABLE "GateOperationProduct" RENAME COLUMN "productId" TO "inventoryId";
ALTER TABLE "GateOperationProduct" DROP CONSTRAINT IF EXISTS "GateOperationProduct_productId_fkey";
ALTER TABLE "GateOperationProduct" ADD CONSTRAINT "GateOperationProduct_inventoryId_fkey" FOREIGN KEY ("inventoryId") REFERENCES "Inventory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER INDEX IF EXISTS "GateOperationProduct_productId_idx" RENAME TO "GateOperationProduct_inventoryId_idx";

-- 8. In GateVerificationProduct table, rename column productId to inventoryId and update foreign key and indexes
ALTER TABLE "GateVerificationProduct" RENAME COLUMN "productId" TO "inventoryId";
ALTER TABLE "GateVerificationProduct" DROP CONSTRAINT IF EXISTS "GateVerificationProduct_productId_fkey";
ALTER TABLE "GateVerificationProduct" ADD CONSTRAINT "GateVerificationProduct_inventoryId_fkey" FOREIGN KEY ("inventoryId") REFERENCES "Inventory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER INDEX IF EXISTS "GateVerificationProduct_productId_idx" RENAME TO "GateVerificationProduct_inventoryId_idx";

-- 9. In GateDocumentReference table, rename column productId to inventoryId and update index
ALTER TABLE "GateDocumentReference" RENAME COLUMN "productId" TO "inventoryId";
ALTER INDEX IF EXISTS "GateDocumentReference_productId_idx" RENAME TO "GateDocumentReference_inventoryId_idx";

-- 10. In StockOpnameItem table, rename column productId to inventoryId, remove productCategory, and update foreign key and indexes
ALTER TABLE "StockOpnameItem" RENAME COLUMN "productId" TO "inventoryId";
ALTER TABLE "StockOpnameItem" DROP COLUMN IF EXISTS "productCategory";
ALTER TABLE "StockOpnameItem" DROP CONSTRAINT IF EXISTS "StockOpnameItem_productId_fkey";
ALTER TABLE "StockOpnameItem" ADD CONSTRAINT "StockOpnameItem_inventoryId_fkey" FOREIGN KEY ("inventoryId") REFERENCES "Inventory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER INDEX IF EXISTS "StockOpnameItem_productId_idx" RENAME TO "StockOpnameItem_inventoryId_idx";

-- 11. In DailyStockSnapshot table, rename column productId to inventoryId, update unique constraint and foreign key and indexes
ALTER TABLE "DailyStockSnapshot" RENAME COLUMN "productId" TO "inventoryId";
ALTER TABLE "DailyStockSnapshot" DROP CONSTRAINT IF EXISTS "DailyStockSnapshot_productId_fkey";
ALTER TABLE "DailyStockSnapshot" ADD CONSTRAINT "DailyStockSnapshot_inventoryId_fkey" FOREIGN KEY ("inventoryId") REFERENCES "Inventory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DailyStockSnapshot" DROP CONSTRAINT IF EXISTS "DailyStockSnapshot_date_warehouseId_productId_key";
ALTER TABLE "DailyStockSnapshot" ADD CONSTRAINT "DailyStockSnapshot_date_warehouseId_inventoryId_key" UNIQUE ("date", "warehouseId", "inventoryId");
ALTER INDEX IF EXISTS "DailyStockSnapshot_productId_idx" RENAME TO "DailyStockSnapshot_inventoryId_idx";

-- 12. In DocumentReferenceItem table, rename column productId to inventoryId
ALTER TABLE "DocumentReferenceItem" RENAME COLUMN "productId" TO "inventoryId";
