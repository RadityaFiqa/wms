import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  UseInterceptors,
  Req,
  BadRequestException,
} from '@nestjs/common';
import { OdooRepository } from './odoo.repository';
import { OdooAuthService } from './odoo-auth.service';
import { OdooSessionManager } from './odoo-session.manager';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { WarehouseGuard } from '../../core/warehouse-context/warehouse.guard';
import { PoliciesGuard } from '../casl/policies.guard';
import { CheckPolicies } from '../casl/policies.decorator';
import { AuditLogInterceptor } from '../audit-log/audit-log.interceptor';
import { AuditLogAction } from '../audit-log/audit-log.decorator';
import { CreateOdooAccountSchema, UpdateOdooAccountSchema } from '@bulog-wms/schema';
import type { CreateOdooAccountInput, UpdateOdooAccountInput } from '@bulog-wms/schema';
import { ZodValidationPipe } from '../../core/pipes/zod-validation.pipe';
import { encrypt } from '../../core/utils/encryption.util';
import { WarehouseContextService } from '../../core/warehouse-context/warehouse-context.service';

@Controller('odoo-accounts')
@UseGuards(JwtAuthGuard, WarehouseGuard, PoliciesGuard)
@UseInterceptors(AuditLogInterceptor)
export class OdooController {
  constructor(
    private readonly repository: OdooRepository,
    private readonly authService: OdooAuthService,
    private readonly sessionManager: OdooSessionManager,
    private readonly warehouseContext: WarehouseContextService,
  ) {}

  @Post()
  @CheckPolicies((ability) => ability.can('create', 'OdooAccount'))
  @AuditLogAction('ODOO_CONFIG_CREATE')
  async create(@Body(new ZodValidationPipe(CreateOdooAccountSchema)) body: CreateOdooAccountInput) {
    // Check if configuration already exists for this warehouse
    const existing = await this.repository.findByWarehouseId(body.warehouseId);
    if (existing) {
      throw new BadRequestException('Konfigurasi Odoo untuk gudang ini sudah ada.');
    }

    const encryptedPassword = encrypt(body.password);
    const account = await this.repository.create({
      warehouseId: body.warehouseId,
      baseUrl: body.baseUrl,
      username: body.username,
      encryptedPassword,
      isActive: true,
    });

    return this.sanitize(account);
  }

  @Get()
  @CheckPolicies((ability) => ability.can('read', 'OdooAccount'))
  async findOneForWarehouse() {
    const warehouseId = this.warehouseContext.getWarehouseId();
    if (!warehouseId) {
      throw new BadRequestException('Warehouse context (header x-warehouse-id) diperlukan.');
    }
    const account = await this.repository.findByWarehouseId(warehouseId);
    return this.sanitize(account);
  }

  @Get(':uuid')
  @CheckPolicies((ability) => ability.can('read', 'OdooAccount'))
  async findOne(@Param('uuid') uuid: string) {
    const account = await this.repository.findByUuid(uuid);
    if (!account) {
      throw new BadRequestException('Konfigurasi Odoo tidak ditemukan.');
    }
    return this.sanitize(account);
  }

  @Put(':uuid')
  @CheckPolicies((ability) => ability.can('update', 'OdooAccount'))
  @AuditLogAction('ODOO_CONFIG_UPDATE')
  async update(
    @Param('uuid') uuid: string,
    @Body(new ZodValidationPipe(UpdateOdooAccountSchema)) body: UpdateOdooAccountInput,
  ) {
    const existing = await this.repository.findByUuid(uuid);
    if (!existing) {
      throw new BadRequestException('Konfigurasi Odoo tidak ditemukan.');
    }

    // Check if warehouse is changing and already assigned to another odoo account config
    if (existing.warehouseId !== body.warehouseId) {
      const warehouseAssignee = await this.repository.findByWarehouseId(body.warehouseId);
      if (warehouseAssignee) {
        throw new BadRequestException('Gudang tujuan sudah dikonfigurasi dengan akun Odoo lain.');
      }
    }

    const updateData: any = {
      warehouseId: body.warehouseId,
      baseUrl: body.baseUrl,
      username: body.username,
      isActive: body.isActive,
    };

    if (body.password) {
      updateData.encryptedPassword = encrypt(body.password);
      // Invalidate existing session if credentials change
      updateData.sessionId = null;
      updateData.csrfToken = null;
      updateData.sessionExpiredAt = null;
    }

    const updated = await this.repository.update(uuid, updateData);
    return this.sanitize(updated);
  }

  @Delete(':uuid')
  @CheckPolicies((ability) => ability.can('delete', 'OdooAccount'))
  @AuditLogAction('ODOO_CONFIG_DELETE')
  async remove(@Param('uuid') uuid: string) {
    const existing = await this.repository.findByUuid(uuid);
    if (!existing) {
      throw new BadRequestException('Konfigurasi Odoo tidak ditemukan.');
    }
    await this.repository.delete(uuid);
    return { message: 'Konfigurasi Odoo berhasil dihapus.' };
  }

  @Post('test-connection-raw')
  @CheckPolicies((ability) => ability.can('create', 'OdooAccount'))
  async testConnectionRaw(@Body() body: any) {
    const { baseUrl, username, password } = body;
    if (!baseUrl || !username || !password) {
      throw new BadRequestException('Base URL, username, dan password harus diisi.');
    }
    return this.authService.testConnectionRaw(baseUrl, username, password);
  }

  @Post(':uuid/test-connection')
  @CheckPolicies((ability) => ability.can('update', 'OdooAccount'))
  @AuditLogAction('ODOO_CONNECTION_TEST')
  async testConnection(@Param('uuid') uuid: string, @Req() req: any) {
    const ipAddress = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'];
    const ipStr = Array.isArray(ipAddress) ? ipAddress[0] : (ipAddress || undefined);
    
    return this.authService.testConnectionByUuid(uuid, req.user?.id, ipStr, userAgent);
  }

  @Post(':uuid/deactivate')
  @CheckPolicies((ability) => ability.can('update', 'OdooAccount'))
  @AuditLogAction('ODOO_CONFIG_DEACTIVATE')
  async deactivate(@Param('uuid') uuid: string) {
    const existing = await this.repository.findByUuid(uuid);
    if (!existing) {
      throw new BadRequestException('Konfigurasi Odoo tidak ditemukan.');
    }
    // Invalidate session on deactivation
    const updated = await this.repository.update(uuid, {
      isActive: false,
      sessionId: null,
      csrfToken: null,
      sessionExpiredAt: null,
    });
    return this.sanitize(updated);
  }

  @Post(':uuid/activate')
  @CheckPolicies((ability) => ability.can('update', 'OdooAccount'))
  @AuditLogAction('ODOO_CONFIG_ACTIVATE')
  async activate(@Param('uuid') uuid: string) {
    const existing = await this.repository.findByUuid(uuid);
    if (!existing) {
      throw new BadRequestException('Konfigurasi Odoo tidak ditemukan.');
    }
    const updated = await this.repository.update(uuid, { isActive: true });
    return this.sanitize(updated);
  }

  @Post(':uuid/refresh')
  @CheckPolicies((ability) => ability.can('update', 'OdooAccount'))
  @AuditLogAction('ODOO_SESSION_MANUAL_REFRESH')
  async refreshSession(@Param('uuid') uuid: string) {
    const existing = await this.repository.findByUuid(uuid);
    if (!existing) {
      throw new BadRequestException('Konfigurasi Odoo tidak ditemukan.');
    }
    if (!existing.isActive) {
      throw new BadRequestException('Akun Odoo tidak aktif. Aktifkan akun terlebih dahulu.');
    }
    
    await this.sessionManager.invalidateSession(existing.id);
    await this.authService.establishSession(existing.id);
    
    const updated = await this.repository.findById(existing.id);
    return this.sanitize(updated);
  }

  private sanitize(account: any) {
    if (!account) return null;
    const { encryptedPassword, ...sanitized } = account;
    return sanitized;
  }
}
