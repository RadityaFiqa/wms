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
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { BuruhService } from '@/modules/buruh/buruh.service';
import { JwtAuthGuard } from '@/modules/auth/guards/jwt-auth.guard';
import { WarehouseGuard } from '@/core/warehouse-context/warehouse.guard';
import { PoliciesGuard } from '@/modules/casl/policies.guard';
import { CheckPolicies } from '@/modules/casl/policies.decorator';
import { AuditLogInterceptor } from '@/modules/audit-log/audit-log.interceptor';
import { AuditLogAction } from '@/modules/audit-log/audit-log.decorator';
import { WarehouseContextService } from '@/core/warehouse-context/warehouse-context.service';
import { ZodValidationPipe } from '@/core/pipes/zod-validation.pipe';
import {
  CreateBuruhSchema,
  type CreateBuruhInput,
  UpdateBuruhSchema,
  type UpdateBuruhInput,
  BuruhQuerySchema,
  type BuruhQueryInput,
} from '@bulog-wms/schema';

@Controller('buruh')
@UseGuards(JwtAuthGuard, WarehouseGuard, PoliciesGuard)
@UseInterceptors(AuditLogInterceptor)
export class BuruhController {
  constructor(
    private readonly buruhService: BuruhService,
    private readonly warehouseContext: WarehouseContextService,
  ) {}

  @Get()
  @CheckPolicies((ability) => ability.can('read', 'Buruh'))
  async findAll(
    @Query(new ZodValidationPipe(BuruhQuerySchema)) query: BuruhQueryInput,
  ) {
    const warehouseId = this.warehouseContext.getWarehouseId()!;
    return this.buruhService.findAll(warehouseId, query);
  }

  @Get(':uuid')
  @CheckPolicies((ability) => ability.can('read', 'Buruh'))
  async findOne(@Param('uuid') uuid: string) {
    const warehouseId = this.warehouseContext.getWarehouseId()!;
    return this.buruhService.findOne(warehouseId, uuid);
  }

  @Post()
  @CheckPolicies((ability) => ability.can('create', 'Buruh'))
  @UseInterceptors(FileInterceptor('ktpPhoto'))
  @AuditLogAction('BURUH_CREATE')
  async create(
    @Req() req: any,
    @Body(new ZodValidationPipe(CreateBuruhSchema)) body: CreateBuruhInput,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    const warehouseId = this.warehouseContext.getWarehouseId()!;
    return this.buruhService.create(warehouseId, body, file, req.user.id);
  }

  @Put(':uuid')
  @CheckPolicies((ability) => ability.can('update', 'Buruh'))
  @UseInterceptors(FileInterceptor('ktpPhoto'))
  @AuditLogAction('BURUH_UPDATE')
  async update(
    @Param('uuid') uuid: string,
    @Body(new ZodValidationPipe(UpdateBuruhSchema)) body: UpdateBuruhInput,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    const warehouseId = this.warehouseContext.getWarehouseId()!;
    return this.buruhService.update(warehouseId, uuid, body, file);
  }

  @Delete(':uuid')
  @CheckPolicies((ability) => ability.can('delete', 'Buruh'))
  @AuditLogAction('BURUH_DELETE')
  async remove(@Param('uuid') uuid: string) {
    const warehouseId = this.warehouseContext.getWarehouseId()!;
    return this.buruhService.remove(warehouseId, uuid);
  }
}
