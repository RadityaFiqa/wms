import {
  Controller,
  Get,
  Query,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { DocumentCategoryService } from './document-category.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { WarehouseGuard } from '../../core/warehouse-context/warehouse.guard';
import { PoliciesGuard } from '../casl/policies.guard';
import { CheckPolicies } from '../casl/policies.decorator';
import { AuditLogInterceptor } from '../audit-log/audit-log.interceptor';

@Controller('document-categories')
@UseGuards(JwtAuthGuard, WarehouseGuard, PoliciesGuard)
@UseInterceptors(AuditLogInterceptor)
export class DocumentCategoryController {
  constructor(private readonly service: DocumentCategoryService) {}

  @Get()
  @CheckPolicies((ability) => ability.can('read', 'DocumentCategory'))
  async findAll(@Query('search') search?: string) {
    return this.service.findAll(search);
  }
}
