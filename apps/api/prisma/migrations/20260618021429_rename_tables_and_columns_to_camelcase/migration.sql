-- AlterTable (Rename ref_fax column on DocumentReference)
ALTER TABLE "DocumentReference" RENAME COLUMN "ref_fax" TO "refFax";

-- AlterTable (Add isActive to OdooAccount)
ALTER TABLE "OdooAccount" ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true;

-- Rename tables
ALTER TABLE "document_categories" RENAME TO "documentCategory";
ALTER TABLE "signature_templates" RENAME TO "signatureTemplate";
ALTER TABLE "manual_documents" RENAME TO "manualDocument";
ALTER TABLE "signed_documents" RENAME TO "signedDocument";
ALTER TABLE "document_verification_logs" RENAME TO "documentVerificationLog";
ALTER TABLE "audit_logs" RENAME TO "signatureAuditLog";
ALTER TABLE "user_signatures" RENAME TO "userSignature";

-- Rename columns
-- For documentCategory
ALTER TABLE "documentCategory" RENAME COLUMN "is_active" TO "isActive";
ALTER TABLE "documentCategory" RENAME COLUMN "deleted_at" TO "deletedAt";
ALTER TABLE "documentCategory" RENAME COLUMN "created_at" TO "createdAt";
ALTER TABLE "documentCategory" RENAME COLUMN "updated_at" TO "updatedAt";

-- For signatureTemplate
ALTER TABLE "signatureTemplate" RENAME COLUMN "page_number" TO "pageNumber";
ALTER TABLE "signatureTemplate" RENAME COLUMN "pos_x" TO "posX";
ALTER TABLE "signatureTemplate" RENAME COLUMN "pos_y" TO "posY";
ALTER TABLE "signatureTemplate" RENAME COLUMN "qr_pos_x" TO "qrPosX";
ALTER TABLE "signatureTemplate" RENAME COLUMN "qr_pos_y" TO "qrPosY";
ALTER TABLE "signatureTemplate" RENAME COLUMN "qr_width" TO "qrWidth";
ALTER TABLE "signatureTemplate" RENAME COLUMN "qr_height" TO "qrHeight";
ALTER TABLE "signatureTemplate" RENAME COLUMN "is_default" TO "isDefault";
ALTER TABLE "signatureTemplate" RENAME COLUMN "is_active" TO "isActive";
ALTER TABLE "signatureTemplate" RENAME COLUMN "deleted_at" TO "deletedAt";
ALTER TABLE "signatureTemplate" RENAME COLUMN "created_at" TO "createdAt";
ALTER TABLE "signatureTemplate" RENAME COLUMN "updated_at" TO "updatedAt";

-- For manualDocument
ALTER TABLE "manualDocument" RENAME COLUMN "warehouse_id" TO "warehouseId";
ALTER TABLE "manualDocument" RENAME COLUMN "category_id" TO "categoryId";
ALTER TABLE "manualDocument" RENAME COLUMN "file_url" TO "fileUrl";
ALTER TABLE "manualDocument" RENAME COLUMN "file_key" TO "fileKey";
ALTER TABLE "manualDocument" RENAME COLUMN "uploaded_by" TO "uploadedBy";
ALTER TABLE "manualDocument" RENAME COLUMN "deleted_at" TO "deletedAt";
ALTER TABLE "manualDocument" RENAME COLUMN "created_at" TO "createdAt";
ALTER TABLE "manualDocument" RENAME COLUMN "updated_at" TO "updatedAt";

-- For signedDocument
ALTER TABLE "signedDocument" RENAME COLUMN "warehouse_id" TO "warehouseId";
ALTER TABLE "signedDocument" RENAME COLUMN "source_type" TO "sourceType";
ALTER TABLE "signedDocument" RENAME COLUMN "source_document_id" TO "sourceDocumentId";
ALTER TABLE "signedDocument" RENAME COLUMN "category_id" TO "categoryId";
ALTER TABLE "signedDocument" RENAME COLUMN "signed_pdf_url" TO "signedPdfUrl";
ALTER TABLE "signedDocument" RENAME COLUMN "file_key" TO "fileKey";
ALTER TABLE "signedDocument" RENAME COLUMN "file_hash" TO "fileHash";
ALTER TABLE "signedDocument" RENAME COLUMN "original_file_key" TO "originalFileKey";
ALTER TABLE "signedDocument" RENAME COLUMN "verification_token" TO "verificationToken";
ALTER TABLE "signedDocument" RENAME COLUMN "signed_by" TO "signedBy";
ALTER TABLE "signedDocument" RENAME COLUMN "signed_at" TO "signedAt";
ALTER TABLE "signedDocument" RENAME COLUMN "signature_template_id" TO "signatureTemplateId";
ALTER TABLE "signedDocument" RENAME COLUMN "deleted_at" TO "deletedAt";
ALTER TABLE "signedDocument" RENAME COLUMN "created_at" TO "createdAt";
ALTER TABLE "signedDocument" RENAME COLUMN "updated_at" TO "updatedAt";

-- For documentVerificationLog
ALTER TABLE "documentVerificationLog" RENAME COLUMN "signed_document_id" TO "signedDocumentId";
ALTER TABLE "documentVerificationLog" RENAME COLUMN "verification_token" TO "verificationToken";
ALTER TABLE "documentVerificationLog" RENAME COLUMN "ip_address" TO "ipAddress";
ALTER TABLE "documentVerificationLog" RENAME COLUMN "user_agent" TO "userAgent";
ALTER TABLE "documentVerificationLog" RENAME COLUMN "verified_at" TO "verifiedAt";

-- For signatureAuditLog
ALTER TABLE "signatureAuditLog" RENAME COLUMN "user_id" TO "userId";
ALTER TABLE "signatureAuditLog" RENAME COLUMN "document_id" TO "documentId";
ALTER TABLE "signatureAuditLog" RENAME COLUMN "created_at" TO "createdAt";

-- For userSignature
ALTER TABLE "userSignature" RENAME COLUMN "user_id" TO "userId";
ALTER TABLE "userSignature" RENAME COLUMN "file_url" TO "fileUrl";
ALTER TABLE "userSignature" RENAME COLUMN "file_key" TO "fileKey";
ALTER TABLE "userSignature" RENAME COLUMN "is_active" TO "isActive";
ALTER TABLE "userSignature" RENAME COLUMN "created_at" TO "createdAt";
ALTER TABLE "userSignature" RENAME COLUMN "updated_at" TO "updatedAt";

-- Rename Primary Key Constraints
ALTER TABLE "documentCategory" RENAME CONSTRAINT "document_categories_pkey" TO "documentCategory_pkey";
ALTER TABLE "signatureTemplate" RENAME CONSTRAINT "signature_templates_pkey" TO "signatureTemplate_pkey";
ALTER TABLE "manualDocument" RENAME CONSTRAINT "manual_documents_pkey" TO "manualDocument_pkey";
ALTER TABLE "signedDocument" RENAME CONSTRAINT "signed_documents_pkey" TO "signedDocument_pkey";
ALTER TABLE "documentVerificationLog" RENAME CONSTRAINT "document_verification_logs_pkey" TO "documentVerificationLog_pkey";
ALTER TABLE "signatureAuditLog" RENAME CONSTRAINT "audit_logs_pkey" TO "signatureAuditLog_pkey";
ALTER TABLE "userSignature" RENAME CONSTRAINT "user_signatures_pkey" TO "userSignature_pkey";

-- Rename Indexes
ALTER INDEX "manual_documents_uuid_key" RENAME TO "manualDocument_uuid_key";
ALTER INDEX "manual_documents_uuid_idx" RENAME TO "manualDocument_uuid_idx";
ALTER INDEX "manual_documents_warehouse_id_idx" RENAME TO "manualDocument_warehouseId_idx";
ALTER INDEX "signed_documents_uuid_key" RENAME TO "signedDocument_uuid_key";
ALTER INDEX "signed_documents_verification_token_key" RENAME TO "signedDocument_verificationToken_key";
ALTER INDEX "signed_documents_uuid_idx" RENAME TO "signedDocument_uuid_idx";
ALTER INDEX "signed_documents_warehouse_id_idx" RENAME TO "signedDocument_warehouseId_idx";

-- Rename Foreign Key Constraints
ALTER TABLE "manualDocument" RENAME CONSTRAINT "manual_documents_category_id_fkey" TO "manualDocument_categoryId_fkey";
ALTER TABLE "manualDocument" RENAME CONSTRAINT "manual_documents_uploaded_by_fkey" TO "manualDocument_uploadedBy_fkey";
ALTER TABLE "manualDocument" RENAME CONSTRAINT "manual_documents_warehouse_id_fkey" TO "manualDocument_warehouseId_fkey";
ALTER TABLE "signedDocument" RENAME CONSTRAINT "signed_documents_category_id_fkey" TO "signedDocument_categoryId_fkey";
ALTER TABLE "signedDocument" RENAME CONSTRAINT "signed_documents_signature_template_id_fkey" TO "signedDocument_signatureTemplateId_fkey";
ALTER TABLE "signedDocument" RENAME CONSTRAINT "signed_documents_signed_by_fkey" TO "signedDocument_signedBy_fkey";
ALTER TABLE "signedDocument" RENAME CONSTRAINT "signed_documents_warehouse_id_fkey" TO "signedDocument_warehouseId_fkey";
ALTER TABLE "documentVerificationLog" RENAME CONSTRAINT "document_verification_logs_signed_document_id_fkey" TO "documentVerificationLog_signedDocumentId_fkey";
ALTER TABLE "signatureAuditLog" RENAME CONSTRAINT "audit_logs_user_id_fkey" TO "signatureAuditLog_userId_fkey";
ALTER TABLE "userSignature" RENAME CONSTRAINT "user_signatures_user_id_fkey" TO "userSignature_userId_fkey";

-- Clean up unused tables (Order, OrderItem)
DROP TABLE "OrderItem";
DROP TABLE "Order";
DROP TYPE "OrderStatus";
