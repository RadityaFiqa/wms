import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  UseInterceptors,
  Req,
} from '@nestjs/common';
import { TagihanDocumentService } from '@/modules/tagihan/tagihan-document.service';
import { JwtAuthGuard } from '@/modules/auth/guards/jwt-auth.guard';
import { WarehouseGuard } from '@/core/warehouse-context/warehouse.guard';
import { PoliciesGuard } from '@/modules/casl/policies.guard';
import { CheckPolicies } from '@/modules/casl/policies.decorator';
import { AuditLogInterceptor } from '@/modules/audit-log/audit-log.interceptor';
import { AuditLogAction } from '@/modules/audit-log/audit-log.decorator';
import { WarehouseContextService } from '@/core/warehouse-context/warehouse-context.service';
import { ZodValidationPipe } from '@/core/pipes/zod-validation.pipe';
import {
  TagihanDocumentQuerySchema,
  type TagihanDocumentQueryInput,
  TagihanDocumentHistoryQuerySchema,
  type TagihanDocumentHistoryQueryInput,
  GenerateSuratPermohonanSchema,
  type GenerateSuratPermohonanInput,
  GenerateTandaTerimaSchema,
  type GenerateTandaTerimaInput,
} from '@bulog-wms/schema';

/**
 * Surat Permohonan & Tanda Terima generation for a Tagihan. Guarded by
 * Tagihan permissions so Finance can use it without DocumentGenerated rights.
 */
@Controller('tagihan/:uuid/documents')
@UseGuards(JwtAuthGuard, WarehouseGuard, PoliciesGuard)
@UseInterceptors(AuditLogInterceptor)
export class TagihanDocumentController {
  constructor(
    private readonly service: TagihanDocumentService,
    private readonly warehouseContext: WarehouseContextService,
  ) {}

  @Get()
  @CheckPolicies((ability) => ability.can('read', 'Tagihan'))
  async listHistory(
    @Param('uuid') uuid: string,
    @Query(new ZodValidationPipe(TagihanDocumentHistoryQuerySchema))
    query: TagihanDocumentHistoryQueryInput,
  ) {
    return this.service.listHistory(this.warehouseId(), uuid, query.purpose);
  }

  @Get('templates')
  @CheckPolicies((ability) => ability.can('read', 'Tagihan'))
  async listTemplates(
    @Param('uuid') uuid: string,
    @Query(new ZodValidationPipe(TagihanDocumentQuerySchema))
    query: TagihanDocumentQueryInput,
  ) {
    return this.service.listTemplates(this.warehouseId(), uuid, query.purpose);
  }

  @Get('prefill')
  @CheckPolicies((ability) => ability.can('read', 'Tagihan'))
  async prefill(
    @Param('uuid') uuid: string,
    @Query(new ZodValidationPipe(TagihanDocumentQuerySchema))
    query: TagihanDocumentQueryInput,
  ) {
    return this.service.prefill(
      this.warehouseId(),
      uuid,
      query.purpose,
      this.timeZone(),
      query.templateUuid,
    );
  }

  @Post('surat-permohonan')
  @CheckPolicies((ability) => ability.can('update', 'Tagihan'))
  @AuditLogAction('TAGIHAN_SURAT_PERMOHONAN_GENERATE')
  async generateSuratPermohonan(
    @Req() req: any,
    @Param('uuid') uuid: string,
    @Body(new ZodValidationPipe(GenerateSuratPermohonanSchema))
    body: GenerateSuratPermohonanInput,
  ) {
    return this.service.generateSuratPermohonan(
      this.warehouseId(),
      uuid,
      body,
      req.user.id,
      this.timeZone(),
    );
  }

  @Post('tanda-terima')
  @CheckPolicies((ability) => ability.can('update', 'Tagihan'))
  @AuditLogAction('TAGIHAN_TANDA_TERIMA_GENERATE')
  async generateTandaTerima(
    @Req() req: any,
    @Param('uuid') uuid: string,
    @Body(new ZodValidationPipe(GenerateTandaTerimaSchema))
    body: GenerateTandaTerimaInput,
  ) {
    return this.service.generateTandaTerima(
      this.warehouseId(),
      uuid,
      body,
      req.user.id,
      this.timeZone(),
    );
  }

  @Get(':docUuid/preview')
  @CheckPolicies((ability) => ability.can('read', 'Tagihan'))
  async preview(@Param('uuid') uuid: string, @Param('docUuid') docUuid: string) {
    return { url: await this.service.getFileUrl(this.warehouseId(), uuid, docUuid, 'preview') };
  }

  @Get(':docUuid/download/pdf')
  @CheckPolicies((ability) => ability.can('read', 'Tagihan'))
  @AuditLogAction('TAGIHAN_DOCUMENT_DOWNLOAD')
  async downloadPdf(@Param('uuid') uuid: string, @Param('docUuid') docUuid: string) {
    return { url: await this.service.getFileUrl(this.warehouseId(), uuid, docUuid, 'pdf') };
  }

  @Get(':docUuid/download/docx')
  @CheckPolicies((ability) => ability.can('read', 'Tagihan'))
  @AuditLogAction('TAGIHAN_DOCUMENT_DOWNLOAD')
  async downloadDocx(@Param('uuid') uuid: string, @Param('docUuid') docUuid: string) {
    return { url: await this.service.getFileUrl(this.warehouseId(), uuid, docUuid, 'docx') };
  }

  private warehouseId() {
    return this.warehouseContext.getWarehouseId()!;
  }

  /** Client time zone for dates in the document; invalid values fall back */
  private timeZone() {
    const tz = this.warehouseContext.getTimezone();
    try {
      new Intl.DateTimeFormat('en-US', { timeZone: tz });
      return tz;
    } catch {
      return 'Asia/Jakarta';
    }
  }
}
