import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  UseInterceptors,
  ParseIntPipe,
  Req,
  Res,
} from '@nestjs/common';
import { SignedDocumentService } from './signed-document.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { WarehouseGuard } from '../../core/warehouse-context/warehouse.guard';
import { PoliciesGuard } from '../casl/policies.guard';
import { CheckPolicies } from '../casl/policies.decorator';
import { AuditLogInterceptor } from '../audit-log/audit-log.interceptor';
import { AuditLogAction } from '../audit-log/audit-log.decorator';
import { SignDocumentSchema } from '@bulog-wms/schema';
import type { SignDocumentInput } from '@bulog-wms/schema';
import { ZodValidationPipe } from '../../core/pipes/zod-validation.pipe';

@Controller('signed-documents')
@UseGuards(JwtAuthGuard, WarehouseGuard, PoliciesGuard)
@UseInterceptors(AuditLogInterceptor)
export class SignedDocumentController {
  constructor(private readonly service: SignedDocumentService) {}

  @Get()
  @CheckPolicies((ability) => ability.can('read', 'SignedDocument'))
  async findAll(
    @Query('search') search?: string,
    @Query('categoryId') categoryId?: string,
    @Query('sourceType') sourceType?: string,
    @Query('status') status?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const parsedCategoryId = categoryId ? parseInt(categoryId, 10) : undefined;
    return this.service.findAll({
      search,
      categoryId: parsedCategoryId,
      sourceType,
      status,
      startDate,
      endDate,
    });
  }

  @Get(':uuid')
  @CheckPolicies((ability) => ability.can('read', 'SignedDocument'))
  async findOne(@Param('uuid') uuid: string) {
    return this.service.findOne(uuid);
  }

  @Get('erp-preview/:uuid')
  @CheckPolicies((ability) => ability.can('read', 'DocumentReference'))
  async previewErpPdf(@Param('uuid') uuid: string, @Res() res: any) {
    const pdfBuffer = await this.service.generateErpPdfBufferByUuid(uuid);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'inline',
      'Content-Length': pdfBuffer.length,
    });
    return res.end(pdfBuffer);
  }

  @Get(':uuid/download')
  @CheckPolicies((ability) => ability.can('read', 'SignedDocument'))
  @AuditLogAction('SIGNED_DOCUMENT_DOWNLOAD')
  async download(@Param('uuid') uuid: string, @Res() res: any) {
    const doc = await this.service.findOne(uuid);
    return res.redirect(doc.signedPdfUrl);
  }

  @Post('sign-erp/:uuid')
  @CheckPolicies((ability) => ability.can('create', 'SignedDocument'))
  @AuditLogAction('ERP_DOCUMENT_SIGN')
  async signErp(
    @Param('uuid') uuid: string,
    @Req() req: any,
    @Body(new ZodValidationPipe(SignDocumentSchema)) body: SignDocumentInput,
  ) {
    const userId = req.user.id;
    const ipAddress = req.ip || req.connection.remoteAddress;
    return this.service.signDocument('ERP', uuid, userId, body, ipAddress);
  }

  @Post('sign-manual/:uuid')
  @CheckPolicies((ability) => ability.can('create', 'SignedDocument'))
  @AuditLogAction('MANUAL_DOCUMENT_SIGN')
  async signManual(
    @Param('uuid') uuid: string,
    @Req() req: any,
    @Body(new ZodValidationPipe(SignDocumentSchema)) body: SignDocumentInput,
  ) {
    const userId = req.user.id;
    const ipAddress = req.ip || req.connection.remoteAddress;
    return this.service.signDocument('MANUAL', uuid, userId, body, ipAddress);
  }
}
