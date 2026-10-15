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
  UploadedFile,
  Req,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { TagihanService } from './tagihan.service';
import { MasterTagihanStatusService } from './master-tagihan-status.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { WarehouseGuard } from '@/core/warehouse-context/warehouse.guard';
import { PoliciesGuard } from '../casl/policies.guard';
import { CheckPolicies } from '../casl/policies.decorator';
import { AuditLogInterceptor } from '../audit-log/audit-log.interceptor';
import { AuditLogAction } from '../audit-log/audit-log.decorator';
import { WarehouseContextService } from '@/core/warehouse-context/warehouse-context.service';
import { ZodValidationPipe } from '@/core/pipes/zod-validation.pipe';
import {
  CreateTagihanSchema,
  type CreateTagihanInput,
  UpdateTagihanSchema,
  type UpdateTagihanInput,
  TagihanQuerySchema,
  type TagihanQueryInput,
  CreateMasterTagihanStatusSchema,
  type CreateMasterTagihanStatusInput,
} from '@bulog-wms/schema';

@Controller('tagihan')
@UseGuards(JwtAuthGuard, WarehouseGuard, PoliciesGuard)
@UseInterceptors(AuditLogInterceptor)
export class TagihanController {
  constructor(
    private readonly tagihanService: TagihanService,
    private readonly statusService: MasterTagihanStatusService,
    private readonly warehouseContext: WarehouseContextService,
  ) {}

  /**
   * List all MasterTagihanStatus options for dropdowns.
   */
  @Get('statuses')
  @CheckPolicies((ability) => ability.can('read', 'Tagihan'))
  async listStatuses() {
    return this.statusService.findAll();
  }

  /**
   * Create a new MasterTagihanStatus on the fly.
   */
  @Post('statuses')
  @CheckPolicies((ability) => ability.can('create', 'Tagihan'))
  @AuditLogAction('TAGIHAN_STATUS_CREATE')
  async createStatus(
    @Body(new ZodValidationPipe(CreateMasterTagihanStatusSchema))
    body: CreateMasterTagihanStatusInput,
  ) {
    return this.statusService.create(body);
  }

  /**
   * Candidate ERP documents for Tagihan selection modal with rules.
   */
  @Get('erp-candidates')
  @CheckPolicies((ability) => ability.can('read', 'Tagihan'))
  async getErpCandidates(
    @Query('tagihanType') tagihanType?: string,
    @Query('search') search?: string,
    @Query('pickingTypeCode') pickingTypeCode?: string,
    @Query('productName') productName?: string,
    @Query('refFax') refFax?: string,
    @Query('month') month?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const warehouseId = this.warehouseContext.getWarehouseId()!;
    return this.tagihanService.getErpCandidates(warehouseId, {
      tagihanType,
      search,
      pickingTypeCode,
      productName,
      refFax,
      month,
      startDate,
      endDate,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  /**
   * List Tagihan records with filtering and pagination.
   */
  @Get()
  @CheckPolicies((ability) => ability.can('read', 'Tagihan'))
  async findAll(@Query() query: TagihanQueryInput) {
    const warehouseId = this.warehouseContext.getWarehouseId()!;
    return this.tagihanService.findAll(warehouseId, query);
  }

  /**
   * Get single Tagihan detail by UUID.
   */
  @Get(':uuid')
  @CheckPolicies((ability) => ability.can('read', 'Tagihan'))
  async findOne(@Param('uuid') uuid: string) {
    const warehouseId = this.warehouseContext.getWarehouseId()!;
    return this.tagihanService.findOne(warehouseId, uuid);
  }

  /**
   * Create new Tagihan.
   */
  @Post()
  @CheckPolicies((ability) => ability.can('create', 'Tagihan'))
  @AuditLogAction('TAGIHAN_CREATE')
  async create(
    @Req() req: any,
    @Body(new ZodValidationPipe(CreateTagihanSchema)) body: CreateTagihanInput,
  ) {
    const warehouseId = this.warehouseContext.getWarehouseId()!;
    const userId = req.user.id;
    return this.tagihanService.create(warehouseId, userId, body, req.user);
  }

  /**
   * Update existing Tagihan by UUID.
   */
  @Put(':uuid')
  @CheckPolicies((ability) => ability.can('update', 'Tagihan'))
  @AuditLogAction('TAGIHAN_UPDATE')
  async update(
    @Req() req: any,
    @Param('uuid') uuid: string,
    @Body(new ZodValidationPipe(UpdateTagihanSchema)) body: UpdateTagihanInput,
  ) {
    const warehouseId = this.warehouseContext.getWarehouseId()!;
    return this.tagihanService.update(warehouseId, uuid, body, req.user);
  }

  /**
   * Delete Tagihan by UUID.
   */
  @Delete(':uuid')
  @CheckPolicies((ability) => ability.can('delete', 'Tagihan'))
  @AuditLogAction('TAGIHAN_DELETE')
  async delete(@Req() req: any, @Param('uuid') uuid: string) {
    const warehouseId = this.warehouseContext.getWarehouseId()!;
    return this.tagihanService.delete(warehouseId, uuid, req.user);
  }

  /**
   * Upload supporting file for Tagihan.
   */
  @Post(':uuid/files')
  @CheckPolicies((ability) => ability.can('update', 'Tagihan'))
  @UseInterceptors(FileInterceptor('file'))
  @AuditLogAction('TAGIHAN_FILE_UPLOAD')
  async uploadFile(
    @Param('uuid') uuid: string,
    @UploadedFile() file: Express.Multer.File,
    @Req() req: any,
  ) {
    if (!file) {
      throw new BadRequestException('File tidak ditemukan.');
    }
    const warehouseId = this.warehouseContext.getWarehouseId()!;
    const userId = req.user.id;
    return this.tagihanService.uploadFile(warehouseId, uuid, file, userId);
  }

  /**
   * Delete supporting file from Tagihan.
   */
  @Delete(':uuid/files/:fileUuid')
  @CheckPolicies((ability) => ability.can('update', 'Tagihan'))
  @AuditLogAction('TAGIHAN_FILE_DELETE')
  async deleteFile(
    @Param('uuid') uuid: string,
    @Param('fileUuid') fileUuid: string,
  ) {
    const warehouseId = this.warehouseContext.getWarehouseId()!;
    return this.tagihanService.deleteFile(warehouseId, uuid, fileUuid);
  }

  /**
   * Get presigned private download URL for supporting file.
   */
  @Get(':uuid/files/:fileUuid/download')
  @CheckPolicies((ability) => ability.can('read', 'Tagihan'))
  async getFileDownloadUrl(
    @Param('uuid') uuid: string,
    @Param('fileUuid') fileUuid: string,
  ) {
    const warehouseId = this.warehouseContext.getWarehouseId()!;
    return this.tagihanService.getFileDownloadUrl(warehouseId, uuid, fileUuid);
  }
}
