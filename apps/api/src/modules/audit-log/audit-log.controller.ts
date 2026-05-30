import { Controller, Get, Query, UseGuards, Req } from '@nestjs/common';
import { AuditLogService } from './audit-log.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { WarehouseGuard } from '../../core/warehouse-context/warehouse.guard';
import { PoliciesGuard } from '../casl/policies.guard';
import { CheckPolicies } from '../casl/policies.decorator';

@Controller('audit-logs')
@UseGuards(JwtAuthGuard, WarehouseGuard, PoliciesGuard)
export class AuditLogController {
  constructor(private readonly auditLogService: AuditLogService) {}

  @Get()
  @CheckPolicies((ability) => ability.can('read', 'AuditLog'))
  async findAll(
    @Req() req: any,
    @Query('search') search?: string,
    @Query('action') action?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.auditLogService.findAll({ search, action, page, limit }, req.user);
  }
}
