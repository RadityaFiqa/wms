-- Additive only: nullable columns, existing rows keep NULL (legacy opnames without calculator detail)
ALTER TABLE "StockOpnameStack" ADD COLUMN IF NOT EXISTS "calculatedPhysical" DOUBLE PRECISION;
ALTER TABLE "StockOpnameStack" ADD COLUMN IF NOT EXISTS "calculationRows" JSONB;
