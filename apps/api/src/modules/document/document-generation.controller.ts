import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  UseInterceptors,
  Req,
} from '@nestjs/common';
import { DocumentGenerationService } from './document-generation.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { WarehouseGuard } from '../../core/warehouse-context/warehouse.guard';
import { PoliciesGuard } from '../casl/policies.guard';
import { CheckPolicies } from '../casl/policies.decorator';
import { AuditLogInterceptor } from '../audit-log/audit-log.interceptor';
import { AuditLogAction } from '../audit-log/audit-log.decorator';
import { GenerateDocumentSchema } from '@bulog-wms/schema';
import type { GenerateDocumentInput } from '@bulog-wms/schema';
import { ZodValidationPipe } from '../../core/pipes/zod-validation.pipe';

@Controller('document')
@UseGuards(JwtAuthGuard, WarehouseGuard, PoliciesGuard)
@UseInterceptors(AuditLogInterceptor)
export class DocumentGenerationController {
  constructor(private readonly service: DocumentGenerationService) {}

  @Post('generate')
  @CheckPolicies((ability) => ability.can('create', 'DocumentGenerated'))
  @AuditLogAction('DOCUMENT_GENERATE')
  async generate(
    @Req() req: any,
    @Body(new ZodValidationPipe(GenerateDocumentSchema))
    body: GenerateDocumentInput,
  ) {
    const userId = req.user.id;
    return this.service.generate(body, userId);
  }

  @Get('generated')
  @CheckPolicies((ability) => ability.can('read', 'DocumentGenerated'))
  async findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('templateId') templateId?: string,
    @Query('categoryId') categoryId?: string,
    @Query('status') status?: string,
    @Query('generatedBy') generatedBy?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const parsedPage = page ? parseInt(page, 10) : undefined;
    const parsedLimit = limit ? parseInt(limit, 10) : undefined;

    return this.service.findAll({
      page: parsedPage,
      limit: parsedLimit,
      search,
      templateId,
      categoryId,
      status,
      generatedBy,
      startDate,
      endDate,
    });
  }

  @Get('generated/:uuid')
  @CheckPolicies((ability) => ability.can('read', 'DocumentGenerated'))
  async findOne(@Param('uuid') uuid: string) {
    return this.service.findOne(uuid);
  }

  @Get('generated/:uuid/preview')
  @CheckPolicies((ability) => ability.can('read', 'DocumentGenerated'))
  async getPreviewUrl(@Param('uuid') uuid: string) {
    const url = await this.service.getPreviewUrl(uuid);
    return { url };
  }

  @Get('generated/:uuid/download/docx')
  @CheckPolicies((ability) => ability.can('read', 'DocumentGenerated'))
  @AuditLogAction('DOCUMENT_DOWNLOAD')
  async getDownloadDocxUrl(@Param('uuid') uuid: string) {
    const url = await this.service.getDownloadDocxUrl(uuid);
    return { url };
  }

  @Get('generated/:uuid/download/pdf')
  @CheckPolicies((ability) => ability.can('read', 'DocumentGenerated'))
  @AuditLogAction('DOCUMENT_DOWNLOAD')
  async getDownloadPdfUrl(@Param('uuid') uuid: string) {
    const url = await this.service.getDownloadPdfUrl(uuid);
    return { url };
  }

  @Delete('generated/:uuid')
  @CheckPolicies((ability) => ability.can('delete', 'DocumentGenerated'))
  @AuditLogAction('DOCUMENT_DELETE')
  async remove(@Param('uuid') uuid: string) {
    return this.service.remove(uuid);
  }
}
