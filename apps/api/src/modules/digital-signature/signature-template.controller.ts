import {
  Controller,
  Get,
  Query,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { SignatureTemplateService } from './signature-template.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { WarehouseGuard } from '../../core/warehouse-context/warehouse.guard';
import { PoliciesGuard } from '../casl/policies.guard';
import { CheckPolicies } from '../casl/policies.decorator';
import { AuditLogInterceptor } from '../audit-log/audit-log.interceptor';

@Controller('signature-templates')
@UseGuards(JwtAuthGuard, WarehouseGuard, PoliciesGuard)
@UseInterceptors(AuditLogInterceptor)
export class SignatureTemplateController {
  constructor(private readonly service: SignatureTemplateService) {}

  @Get()
  @CheckPolicies((ability) => ability.can('read', 'SignatureTemplate'))
  async findAll(@Query('search') search?: string) {
    return this.service.findAll(search);
  }
}
