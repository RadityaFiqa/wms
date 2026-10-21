-- Additive only: stock opname prefill from the previous COMPLETED opname for unmoved tumpukan.
-- New nullable columns / defaults only, existing opnames keep NULL / false.

DO $$ BEGIN
    CREATE TYPE "StockOpnameStackMovement" AS ENUM ('CHANGED', 'UNCHANGED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- AlterTable StockOpname: comparison baseline
ALTER TABLE "StockOpname" ADD COLUMN IF NOT EXISTS "previousStockOpnameId" INTEGER;

-- AlterTable StockOpnameStack: movement classification and confirmation of prefilled counts
ALTER TABLE "StockOpnameStack" ADD COLUMN IF NOT EXISTS "movementStatus" "StockOpnameStackMovement";
ALTER TABLE "StockOpnameStack" ADD COLUMN IF NOT EXISTS "movementReasons" JSONB;
ALTER TABLE "StockOpnameStack" ADD COLUMN IF NOT EXISTS "requiresConfirmation" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "StockOpnameStack" ADD COLUMN IF NOT EXISTS "confirmedAt" TIMESTAMPTZ(3);
ALTER TABLE "StockOpnameStack" ADD COLUMN IF NOT EXISTS "confirmedById" INTEGER;

DO $$ BEGIN
    ALTER TABLE "StockOpname" ADD CONSTRAINT "StockOpname_previousStockOpnameId_fkey" FOREIGN KEY ("previousStockOpnameId") REFERENCES "StockOpname"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "StockOpnameStack" ADD CONSTRAINT "StockOpnameStack_confirmedById_fkey" FOREIGN KEY ("confirmedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
