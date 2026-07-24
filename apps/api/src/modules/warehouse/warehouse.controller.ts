import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  UseInterceptors,
  Req,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { WarehouseService } from './warehouse.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PoliciesGuard } from '../casl/policies.guard';
import { CheckPolicies } from '../casl/policies.decorator';
import { AuditLogInterceptor } from '../audit-log/audit-log.interceptor';
import { AuditLogAction } from '../audit-log/audit-log.decorator';
import {
  CreateWarehouseSchema,
  UpdateWarehouseSchema,
} from '@bulog-wms/schema';
import type {
  CreateWarehouseInput,
  UpdateWarehouseInput,
} from '@bulog-wms/schema';
import { ZodValidationPipe } from '../../core/pipes/zod-validation.pipe';
import { PrismaService } from '../../core/prisma/prisma.service';
import { WarehouseGuard } from '../../core/warehouse-context/warehouse.guard';
import { WarehouseContextService } from '../../core/warehouse-context/warehouse-context.service';


@Controller('warehouses')
@UseGuards(JwtAuthGuard, WarehouseGuard, PoliciesGuard)
@UseInterceptors(AuditLogInterceptor)
export class WarehouseController {
  constructor(
    private readonly service: WarehouseService,
    private readonly prisma: PrismaService,
    private readonly warehouseContext: WarehouseContextService,
  ) {}

  @Post()
  @CheckPolicies((ability) => ability.can('create', 'Warehouse'))
  @AuditLogAction('WAREHOUSE_CREATE')
  async create(
    @Req() req: any,
    @Body(new ZodValidationPipe(CreateWarehouseSchema))
    body: CreateWarehouseInput,
  ) {
    if (req.user?.role?.name !== 'SUPER_ADMIN') {
      throw new ForbiddenException(
        'Akses ditolak. Hanya Super Admin yang dapat membuat gudang.',
      );
    }
    return this.service.create(body);
  }

  @Get()
  @CheckPolicies((ability) => ability.can('read', 'Warehouse'))
  async findAll(
    @Req() req: any,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const user = req.user;
    const roleName = user.role?.name || user.role;

    let allowedIds: number[] | undefined = undefined;
    let activeOnly = false;

    if (roleName !== 'SUPER_ADMIN') {
      activeOnly = true;
      const accesses = await this.prisma.warehouseAccess.findMany({
        where: { userId: user.id },
        select: { warehouseId: true },
      });
      allowedIds = accesses.map((a) => a.warehouseId);
    }

    return this.service.findAll({
      search,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
      activeOnly,
      allowedIds,
    });
  }

  @Get(':uuid')
  @CheckPolicies((ability) => ability.can('read', 'Warehouse'))
  async findOne(@Param('uuid') uuid: string, @Req() req: any) {
    if (req.user?.role?.name !== 'SUPER_ADMIN') {
      throw new ForbiddenException(
        'Akses ditolak. Hanya Super Admin yang dapat melihat detail manajemen gudang.',
      );
    }
    return this.service.findByUuid(uuid);
  }

  @Put(':uuid')
  @CheckPolicies((ability) => ability.can('update', 'Warehouse'))
  @AuditLogAction('WAREHOUSE_UPDATE')
  async update(
    @Param('uuid') uuid: string,
    @Req() req: any,
    @Body(new ZodValidationPipe(UpdateWarehouseSchema))
    body: UpdateWarehouseInput,
  ) {
    if (req.user?.role?.name !== 'SUPER_ADMIN') {
      throw new ForbiddenException(
        'Akses ditolak. Hanya Super Admin yang dapat memperbarui gudang.',
      );
    }
    return this.service.update(uuid, body);
  }

  @Delete(':uuid')
  @CheckPolicies((ability) => ability.can('delete', 'Warehouse'))
  @AuditLogAction('WAREHOUSE_DEACTIVATE')
  async remove(@Param('uuid') uuid: string, @Req() req: any) {
    if (req.user?.role?.name !== 'SUPER_ADMIN') {
      throw new ForbiddenException(
        'Akses ditolak. Hanya Super Admin yang dapat menonaktifkan gudang.',
      );
    }
    return this.service.remove(uuid);
  }
}
