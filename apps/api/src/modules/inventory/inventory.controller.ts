import {
  Controller,
  Get,
  Post,
  Query,
  Param,
  UseGuards,
  UseInterceptors,
  BadRequestException,
  Req,
  Res,
} from '@nestjs/common';
import { InventoryService } from './inventory.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { WarehouseGuard } from '../../core/warehouse-context/warehouse.guard';
import { PoliciesGuard } from '../casl/policies.guard';
import { CheckPolicies } from '../casl/policies.decorator';
import { AuditLogInterceptor } from '../audit-log/audit-log.interceptor';
import { AuditLogAction } from '../audit-log/audit-log.decorator';
import { WarehouseContextService } from '../../core/warehouse-context/warehouse-context.service';
import { PrismaService } from '../../core/prisma/prisma.service';

@Controller('inventory')
@UseGuards(JwtAuthGuard, WarehouseGuard, PoliciesGuard)
@UseInterceptors(AuditLogInterceptor)
export class InventoryController {
  constructor(
    private readonly service: InventoryService,
    private readonly warehouseContext: WarehouseContextService,
    private readonly prisma: PrismaService,
  ) {}

  @Get()
  @CheckPolicies((ability) => ability.can('read', 'Inventory'))
  async findAll(
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const warehouseId = this.warehouseContext.getWarehouseId();
    if (!warehouseId) {
      throw new BadRequestException(
        'Warehouse context (header x-warehouse-id) diperlukan.',
      );
    }
    return this.service.findAll(warehouseId, {
      search,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  @Get('products')
  @CheckPolicies(
    (ability) =>
      ability.can('read', 'GateOperation') || ability.can('read', 'Inventory'),
  )
  async findAllProducts(
    @Query('search') search?: string,
    @Query('selectedId') selectedId?: string,
    @Query('onlyAvailable') onlyAvailable?: string,
    @Query('limit') limit?: string,
  ) {
    const warehouseId = this.warehouseContext.getWarehouseId();
    if (!warehouseId) {
      throw new BadRequestException(
        'Warehouse context (header x-warehouse-id) diperlukan.',
      );
    }
    const where: any = {
      warehouseId,
    };
    if (search) {
      where.AND = [
        {
          OR: [
            { name: { contains: search, mode: 'insensitive' } },
            { sku: { contains: search, mode: 'insensitive' } },
          ],
        },
      ];
    }

    if (onlyAvailable === 'true') {
      where.quants = {
        some: {
          availableQuantity: {
            gt: 0,
          },
        },
      };
    }

    const take = limit ? parseInt(limit, 10) : 20;

    const products = await this.prisma.inventory.findMany({
      where,
      orderBy: { name: 'asc' },
      take,
    });

    if (selectedId) {
      const selId = parseInt(selectedId, 10);
      if (!isNaN(selId) && !products.some((p) => p.id === selId)) {
        const selectedProduct = await this.prisma.inventory.findFirst({
          where: {
            id: selId,
            warehouseId,
          },
        });
        if (selectedProduct) {
          products.unshift(selectedProduct);
        }
      }
    }

    return products;
  }

  @Get('sync/status')
  @CheckPolicies((ability) => ability.can('read', 'Inventory'))
  async getSyncStatus() {
    const warehouseId = this.warehouseContext.getWarehouseId();
    if (!warehouseId) {
      throw new BadRequestException(
        'Warehouse context (header x-warehouse-id) diperlukan.',
      );
    }

    const account = await this.prismaFindAccountByWarehouseId(warehouseId);
    if (!account) {
      return {
        lastSyncAt: null,
        lastSyncStatus: null,
        lastSyncError: null,
        lastSyncBy: null,
        lastSyncCount: null,
      };
    }

    return {
      lastSyncAt: account.lastSyncInventoryAt,
      lastSyncStatus: account.lastSyncInventoryStatus,
      lastSyncError: account.lastSyncInventoryError,
      lastSyncBy: account.lastSyncInventoryBy,
      lastSyncCount: account.lastSyncInventoryCount,
    };
  }

  @Get('export/pdf')
  @CheckPolicies((ability) => ability.can('read', 'Inventory'))
  async exportPdf(@Res() res: any, @Query('search') search?: string) {
    const warehouseId = this.warehouseContext.getWarehouseId();
    if (!warehouseId) {
      throw new BadRequestException(
        'Warehouse context (header x-warehouse-id) diperlukan.',
      );
    }

    const pdfBuffer = await this.service.generatePdfReport(warehouseId, {
      search,
    });

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename=inventory-report-${Date.now()}.pdf`,
      'Content-Length': pdfBuffer.length,
    });

    res.end(pdfBuffer);
  }

  @Get('locations')
  @CheckPolicies((ability) => ability.can('read', 'Inventory'))
  async findAllLocations() {
    const warehouseId = this.warehouseContext.getWarehouseId();
    if (!warehouseId) {
      throw new BadRequestException(
        'Warehouse context (header x-warehouse-id) diperlukan.',
      );
    }
    return this.prisma.location.findMany({
      where: { warehouseId },
      orderBy: { displayName: 'asc' },
    });
  }

  @Get(':uuid')
  @CheckPolicies((ability) => ability.can('read', 'Inventory'))
  async findDetail(@Param('uuid') uuid: string) {
    const warehouseId = this.warehouseContext.getWarehouseId();
    if (!warehouseId) {
      throw new BadRequestException(
        'Warehouse context (header x-warehouse-id) diperlukan.',
      );
    }
    return this.service.findDetail(warehouseId, uuid);
  }

  private async prismaFindAccountByWarehouseId(warehouseId: number) {
    return this.prisma.odooAccount.findUnique({
      where: { warehouseId },
    });
  }
}
