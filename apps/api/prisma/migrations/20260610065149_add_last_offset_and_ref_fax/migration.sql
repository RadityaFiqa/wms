-- AlterTable
ALTER TABLE "DocumentReference" ADD COLUMN     "ref_fax" VARCHAR(255);

-- AlterTable
ALTER TABLE "OdooAccount" ADD COLUMN     "lastOffset" INTEGER NOT NULL DEFAULT 0;
