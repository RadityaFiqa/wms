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
  ParseIntPipe,
  Req,
} from '@nestjs/common';
import { ManualDocumentService } from './manual-document.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { WarehouseGuard } from '../../core/warehouse-context/warehouse.guard';
import { PoliciesGuard } from '../casl/policies.guard';
import { CheckPolicies } from '../casl/policies.decorator';
import { AuditLogInterceptor } from '../audit-log/audit-log.interceptor';
import { AuditLogAction } from '../audit-log/audit-log.decorator';
import { CreateManualDocumentSchema } from '@bulog-wms/schema';
import type { CreateManualDocumentInput } from '@bulog-wms/schema';
import { ZodValidationPipe } from '../../core/pipes/zod-validation.pipe';

@Controller('manual-documents')
@UseGuards(JwtAuthGuard, WarehouseGuard, PoliciesGuard)
@UseInterceptors(AuditLogInterceptor)
export class ManualDocumentController {
  constructor(private readonly service: ManualDocumentService) {}

  @Get()
  @CheckPolicies((ability) => ability.can('read', 'ManualDocument'))
  async findAll(
    @Query('search') search?: string,
    @Query('categoryId') categoryId?: string,
  ) {
    const parsedCategoryId = categoryId ? parseInt(categoryId, 10) : undefined;
    return this.service.findAll({ search, categoryId: parsedCategoryId });
  }

  @Get(':uuid')
  @CheckPolicies((ability) => ability.can('read', 'ManualDocument'))
  async findOne(@Param('uuid') uuid: string) {
    return this.service.findOne(uuid);
  }

  @Post()
  @CheckPolicies((ability) => ability.can('create', 'ManualDocument'))
  @AuditLogAction('MANUAL_DOCUMENT_CREATE')
  async create(
    @Req() req: any,
    @Body(new ZodValidationPipe(CreateManualDocumentSchema))
    body: CreateManualDocumentInput,
  ) {
    const userId = req.user.id;
    return this.service.create(body, userId);
  }

  @Delete(':uuid')
  @CheckPolicies((ability) => ability.can('delete', 'ManualDocument'))
  @AuditLogAction('MANUAL_DOCUMENT_DELETE')
  async remove(@Param('uuid') uuid: string) {
    return this.service.remove(uuid);
  }
}
