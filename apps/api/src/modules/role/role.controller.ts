import { Controller, Get, Post, Put, Body, Param, UseGuards, UseInterceptors } from '@nestjs/common';
import { RoleService } from './role.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PoliciesGuard } from '../casl/policies.guard';
import { CheckPolicies } from '../casl/policies.decorator';
import { AuditLogInterceptor } from '../audit-log/audit-log.interceptor';
import { AuditLogAction } from '../audit-log/audit-log.decorator';
import { CreateRoleSchema } from '@bulog-wms/schema';
import type { CreateRoleInput } from '@bulog-wms/schema';
import { ZodValidationPipe } from '../../core/pipes/zod-validation.pipe';

@Controller('roles')
@UseGuards(JwtAuthGuard, PoliciesGuard)
@UseInterceptors(AuditLogInterceptor)
export class RoleController {
  constructor(private readonly roleService: RoleService) {}

  @Get()
  @CheckPolicies((ability) => ability.can('read', 'Role'))
  async findAll() {
    return this.roleService.findAll();
  }

  @Get('permissions')
  @CheckPolicies((ability) => ability.can('read', 'Permission'))
  async findAllPermissions() {
    return this.roleService.findAllPermissions();
  }

  @Get(':uuid')
  @CheckPolicies((ability) => ability.can('read', 'Role'))
  async findOne(@Param('uuid') uuid: string) {
    return this.roleService.findByUuid(uuid);
  }

  @Post()
  @CheckPolicies((ability) => ability.can('create', 'Role'))
  @AuditLogAction('ROLE_CREATE')
  async create(@Body(new ZodValidationPipe(CreateRoleSchema)) body: CreateRoleInput) {
    return this.roleService.create(body);
  }

  @Put(':uuid')
  @CheckPolicies((ability) => ability.can('update', 'Role'))
  @AuditLogAction('ROLE_UPDATE')
  async update(
    @Param('uuid') uuid: string,
    @Body() body: { description?: string | null; permissionIds?: number[] },
  ) {
    return this.roleService.update(uuid, body);
  }
}
