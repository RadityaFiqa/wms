-- AlterTable Buruh: mandor flag (single mandor per warehouse enforced in BuruhService)
ALTER TABLE "Buruh" ADD COLUMN IF NOT EXISTS "isMandor" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS "Buruh_warehouseId_isMandor_idx" ON "Buruh"("warehouseId", "isMandor");
