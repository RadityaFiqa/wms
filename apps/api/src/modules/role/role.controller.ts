import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  UseGuards,
  UseInterceptors,
  Req,
  ForbiddenException,
} from '@nestjs/common';
import { RoleService } from './role.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { WarehouseGuard } from '../../core/warehouse-context/warehouse.guard';
import { PoliciesGuard } from '../casl/policies.guard';
import { CheckPolicies } from '../casl/policies.decorator';
import { AuditLogInterceptor } from '../audit-log/audit-log.interceptor';
import { AuditLogAction } from '../audit-log/audit-log.decorator';
import { CreateRoleSchema } from '@bulog-wms/schema';
import type { CreateRoleInput } from '@bulog-wms/schema';
import { ZodValidationPipe } from '../../core/pipes/zod-validation.pipe';

@Controller('roles')
@UseGuards(JwtAuthGuard, WarehouseGuard, PoliciesGuard)
@UseInterceptors(AuditLogInterceptor)
export class RoleController {
  constructor(private readonly roleService: RoleService) {}

  @Get()
  @CheckPolicies((ability) => ability.can('read', 'Role'))
  async findAll(@Req() req: any) {
    if (
      req.user.role?.name !== 'SUPER_ADMIN' &&
      req.user.role?.name !== 'WAREHOUSE_ADMIN'
    ) {
      throw new ForbiddenException(
        'Akses ditolak. Hanya Super Admin atau Warehouse Admin yang dapat melihat Role.',
      );
    }
    return this.roleService.findAll();
  }

  @Get('permissions')
  @CheckPolicies((ability) => ability.can('read', 'Permission'))
  async findAllPermissions(@Req() req: any) {
    if (
      req.user.role?.name !== 'SUPER_ADMIN' &&
      req.user.role?.name !== 'WAREHOUSE_ADMIN'
    ) {
      throw new ForbiddenException(
        'Akses ditolak. Hanya Super Admin atau Warehouse Admin yang dapat melihat Permission.',
      );
    }
    return this.roleService.findAllPermissions();
  }

  @Get(':uuid')
  @CheckPolicies((ability) => ability.can('read', 'Role'))
  async findOne(@Param('uuid') uuid: string, @Req() req: any) {
    if (
      req.user.role?.name !== 'SUPER_ADMIN' &&
      req.user.role?.name !== 'WAREHOUSE_ADMIN'
    ) {
      throw new ForbiddenException(
        'Akses ditolak. Hanya Super Admin atau Warehouse Admin yang dapat melihat detail Role.',
      );
    }
    return this.roleService.findByUuid(uuid);
  }

  @Post()
  @CheckPolicies((ability) => ability.can('create', 'Role'))
  @AuditLogAction('ROLE_CREATE')
  async create(
    @Req() req: any,
    @Body(new ZodValidationPipe(CreateRoleSchema)) body: CreateRoleInput,
  ) {
    if (req.user.role?.name !== 'SUPER_ADMIN') {
      throw new ForbiddenException(
        'Akses ditolak. Hanya Super Admin yang dapat mengakses manajemen Role.',
      );
    }
    return this.roleService.create(body);
  }

  @Put(':uuid')
  @CheckPolicies((ability) => ability.can('update', 'Role'))
  @AuditLogAction('ROLE_UPDATE')
  async update(
    @Param('uuid') uuid: string,
    @Req() req: any,
    @Body() body: { description?: string | null; permissionIds?: number[] },
  ) {
    if (req.user.role?.name !== 'SUPER_ADMIN') {
      throw new ForbiddenException(
        'Akses ditolak. Hanya Super Admin yang dapat mengakses manajemen Role.',
      );
    }
    return this.roleService.update(uuid, body);
  }
}
