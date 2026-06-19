-- Rename tables
ALTER TABLE "documentCategory" RENAME TO "DocumentCategory";
ALTER TABLE "signatureTemplate" RENAME TO "SignatureTemplate";
ALTER TABLE "manualDocument" RENAME TO "ManualDocument";
ALTER TABLE "signedDocument" RENAME TO "SignedDocument";
ALTER TABLE "documentVerificationLog" RENAME TO "DocumentVerificationLog";
ALTER TABLE "userSignature" RENAME TO "UserSignature";

-- Rename Primary Key Constraints
ALTER TABLE "DocumentCategory" RENAME CONSTRAINT "documentCategory_pkey" TO "DocumentCategory_pkey";
ALTER TABLE "SignatureTemplate" RENAME CONSTRAINT "signatureTemplate_pkey" TO "SignatureTemplate_pkey";
ALTER TABLE "ManualDocument" RENAME CONSTRAINT "manualDocument_pkey" TO "ManualDocument_pkey";
ALTER TABLE "SignedDocument" RENAME CONSTRAINT "signedDocument_pkey" TO "SignedDocument_pkey";
ALTER TABLE "DocumentVerificationLog" RENAME CONSTRAINT "documentVerificationLog_pkey" TO "DocumentVerificationLog_pkey";
ALTER TABLE "UserSignature" RENAME CONSTRAINT "userSignature_pkey" TO "UserSignature_pkey";

-- Rename Indexes
ALTER INDEX "manualDocument_uuid_key" RENAME TO "ManualDocument_uuid_key";
ALTER INDEX "manualDocument_uuid_idx" RENAME TO "ManualDocument_uuid_idx";
ALTER INDEX "manualDocument_warehouseId_idx" RENAME TO "ManualDocument_warehouseId_idx";
ALTER INDEX "signedDocument_uuid_key" RENAME TO "SignedDocument_uuid_key";
ALTER INDEX "signedDocument_verificationToken_key" RENAME TO "SignedDocument_verificationToken_key";
ALTER INDEX "signedDocument_uuid_idx" RENAME TO "SignedDocument_uuid_idx";
ALTER INDEX "signedDocument_warehouseId_idx" RENAME TO "SignedDocument_warehouseId_idx";

-- Rename Foreign Key Constraints
ALTER TABLE "ManualDocument" RENAME CONSTRAINT "manualDocument_categoryId_fkey" TO "ManualDocument_categoryId_fkey";
ALTER TABLE "ManualDocument" RENAME CONSTRAINT "manualDocument_uploadedBy_fkey" TO "ManualDocument_uploadedBy_fkey";
ALTER TABLE "ManualDocument" RENAME CONSTRAINT "manualDocument_warehouseId_fkey" TO "ManualDocument_warehouseId_fkey";

ALTER TABLE "SignedDocument" RENAME CONSTRAINT "signedDocument_categoryId_fkey" TO "SignedDocument_categoryId_fkey";
ALTER TABLE "SignedDocument" RENAME CONSTRAINT "signedDocument_signatureTemplateId_fkey" TO "SignedDocument_signatureTemplateId_fkey";
ALTER TABLE "SignedDocument" RENAME CONSTRAINT "signedDocument_signedBy_fkey" TO "SignedDocument_signedBy_fkey";
ALTER TABLE "SignedDocument" RENAME CONSTRAINT "signedDocument_warehouseId_fkey" TO "SignedDocument_warehouseId_fkey";

ALTER TABLE "DocumentVerificationLog" RENAME CONSTRAINT "documentVerificationLog_signedDocumentId_fkey" TO "DocumentVerificationLog_signedDocumentId_fkey";

ALTER TABLE "UserSignature" RENAME CONSTRAINT "userSignature_userId_fkey" TO "UserSignature_userId_fkey";
