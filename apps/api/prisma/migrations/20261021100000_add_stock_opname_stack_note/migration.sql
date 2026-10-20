-- Additive only: nullable column, existing rows keep NULL
ALTER TABLE "StockOpnameStack" ADD COLUMN IF NOT EXISTS "note" TEXT;
