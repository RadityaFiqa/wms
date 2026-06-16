import { Module } from '@nestjs/common';
import { DocumentCategoryController } from './document-category.controller';
import { DocumentCategoryService } from './document-category.service';
import { SignatureTemplateController } from './signature-template.controller';
import { SignatureTemplateService } from './signature-template.service';
import { ManualDocumentController } from './manual-document.controller';
import { ManualDocumentService } from './manual-document.service';
import { SignedDocumentController } from './signed-document.controller';
import { SignedDocumentService } from './signed-document.service';
import { DocumentVerificationController } from './document-verification.controller';
import { UserSignatureController } from './user-signature.controller';
import { UserSignatureService } from './user-signature.service';
import { StorageModule } from '../storage/storage.module';

@Module({
  imports: [StorageModule],
  controllers: [
    DocumentCategoryController,
    SignatureTemplateController,
    ManualDocumentController,
    SignedDocumentController,
    DocumentVerificationController,
    UserSignatureController,
  ],
  providers: [
    DocumentCategoryService,
    SignatureTemplateService,
    ManualDocumentService,
    SignedDocumentService,
    UserSignatureService,
  ],
  exports: [SignedDocumentService, UserSignatureService],
})
export class DigitalSignatureModule {}
