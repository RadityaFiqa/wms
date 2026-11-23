-- Peta tumpukan: hide a stack from the map

ALTER TABLE "StackMapLabel" ADD COLUMN "hidden" BOOLEAN NOT NULL DEFAULT false;
