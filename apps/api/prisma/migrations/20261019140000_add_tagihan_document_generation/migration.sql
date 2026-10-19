-- Additive only: Tagihan document generation (Surat Permohonan / Tanda Terima)

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "TagihanDocumentPurpose" AS ENUM ('SURAT_PERMOHONAN', 'TANDA_TERIMA');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- AlterTable DocumentTemplate: tagihan usage and applicable type
ALTER TABLE "DocumentTemplate" ADD COLUMN IF NOT EXISTS "tagihanPurpose" "TagihanDocumentPurpose";
ALTER TABLE "DocumentTemplate" ADD COLUMN IF NOT EXISTS "tagihanType" "TagihanType";

-- AlterTable DocumentGenerated: tagihan link, progress and input snapshot
ALTER TABLE "DocumentGenerated" ADD COLUMN IF NOT EXISTS "tagihanId" INTEGER;
ALTER TABLE "DocumentGenerated" ADD COLUMN IF NOT EXISTS "tagihanPurpose" "TagihanDocumentPurpose";
ALTER TABLE "DocumentGenerated" ADD COLUMN IF NOT EXISTS "progress" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "DocumentGenerated" ADD COLUMN IF NOT EXISTS "stage" TEXT;
ALTER TABLE "DocumentGenerated" ADD COLUMN IF NOT EXISTS "inputSnapshot" JSONB;

-- AlterTable TagihanFile: link to the generation that produced it
ALTER TABLE "TagihanFile" ADD COLUMN IF NOT EXISTS "documentGeneratedId" INTEGER;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "DocumentTemplate_tagihanPurpose_tagihanType_idx" ON "DocumentTemplate"("tagihanPurpose", "tagihanType");
CREATE INDEX IF NOT EXISTS "DocumentGenerated_tagihanId_tagihanPurpose_idx" ON "DocumentGenerated"("tagihanId", "tagihanPurpose");
CREATE INDEX IF NOT EXISTS "TagihanFile_documentGeneratedId_idx" ON "TagihanFile"("documentGeneratedId");

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "DocumentGenerated" ADD CONSTRAINT "DocumentGenerated_tagihanId_fkey" FOREIGN KEY ("tagihanId") REFERENCES "Tagihan"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "TagihanFile" ADD CONSTRAINT "TagihanFile_documentGeneratedId_fkey" FOREIGN KEY ("documentGeneratedId") REFERENCES "DocumentGenerated"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
