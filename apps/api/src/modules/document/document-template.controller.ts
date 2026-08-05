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
import { DocumentTemplateService } from './document-template.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { WarehouseGuard } from '../../core/warehouse-context/warehouse.guard';
import { PoliciesGuard } from '../casl/policies.guard';
import { CheckPolicies } from '../casl/policies.decorator';
import { AuditLogInterceptor } from '../audit-log/audit-log.interceptor';
import { AuditLogAction } from '../audit-log/audit-log.decorator';
import { CreateDocumentTemplateSchema, UpdateDocumentTemplateSchema, UpdateAssemblySchema, UpdatePlaceholdersSchema } from '@bulog-wms/schema';
import type { CreateDocumentTemplateInput, UpdateDocumentTemplateInput, UpdateAssemblyInput, UpdatePlaceholdersInput } from '@bulog-wms/schema';
import { ZodValidationPipe } from '../../core/pipes/zod-validation.pipe';

@Controller('templates')
@UseGuards(JwtAuthGuard, WarehouseGuard, PoliciesGuard)
@UseInterceptors(AuditLogInterceptor)
export class DocumentTemplateController {
  constructor(private readonly service: DocumentTemplateService) {}

  @Get()
  @CheckPolicies((ability) => ability.can('read', 'DocumentTemplate'))
  async findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('categoryId') categoryId?: string,
    @Query('active') active?: string,
  ) {
    const parsedPage = page ? parseInt(page, 10) : undefined;
    const parsedLimit = limit ? parseInt(limit, 10) : undefined;
    const parsedActive = active !== undefined ? active === 'true' : undefined;

    return this.service.findAll({
      page: parsedPage,
      limit: parsedLimit,
      search,
      categoryId,
      active: parsedActive,
    });
  }

  @Get(':uuid')
  @CheckPolicies((ability) => ability.can('read', 'DocumentTemplate'))
  async findOne(@Param('uuid') uuid: string) {
    return this.service.findOne(uuid);
  }

  @Post()
  @CheckPolicies((ability) => ability.can('create', 'DocumentTemplate'))
  @AuditLogAction('TEMPLATE_CREATE')
  @UseInterceptors(FileInterceptor('file'))
  async create(
    @Req() req: any,
    @Body(new ZodValidationPipe(CreateDocumentTemplateSchema))
    body: CreateDocumentTemplateInput,
    @UploadedFile() file: Express.Multer.File,
  ) {
    const userId = req.user.id;
    return this.service.create(body, file, userId);
  }

  @Put(':uuid')
  @CheckPolicies((ability) => ability.can('update', 'DocumentTemplate'))
  @AuditLogAction('TEMPLATE_UPDATE')
  async update(
    @Param('uuid') uuid: string,
    @Body(new ZodValidationPipe(UpdateDocumentTemplateSchema))
    body: UpdateDocumentTemplateInput,
  ) {
    return this.service.update(uuid, body);
  }

  @Post(':uuid/version')
  @CheckPolicies((ability) => ability.can('update', 'DocumentTemplate'))
  @AuditLogAction('TEMPLATE_VERSION_CREATE')
  @UseInterceptors(FileInterceptor('file'))
  async uploadNewVersion(
    @Req() req: any,
    @Param('uuid') uuid: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    const userId = req.user.id;
    return this.service.uploadNewVersion(uuid, file, userId);
  }

  @Delete(':uuid')
  @CheckPolicies((ability) => ability.can('delete', 'DocumentTemplate'))
  @AuditLogAction('TEMPLATE_DELETE')
  async remove(@Param('uuid') uuid: string) {
    return this.service.remove(uuid);
  }

  @Get(':uuid/assembly')
  @CheckPolicies((ability) => ability.can('read', 'DocumentTemplate'))
  async getAssembly(@Param('uuid') uuid: string) {
    return this.service.getAssembly(uuid);
  }

  @Put(':uuid/assembly')
  @CheckPolicies((ability) => ability.can('update', 'DocumentTemplate'))
  @AuditLogAction('ASSEMBLY_UPDATE')
  async updateAssembly(
    @Param('uuid') uuid: string,
    @Body(new ZodValidationPipe(UpdateAssemblySchema))
    body: UpdateAssemblyInput,
  ) {
    return this.service.updateAssembly(uuid, body);
  }

  @Get(':uuid/placeholders')
  @CheckPolicies((ability) => ability.can('read', 'DocumentTemplate'))
  async getPlaceholders(@Param('uuid') uuid: string) {
    return this.service.getPlaceholders(uuid);
  }

  @Put(':uuid/placeholders')
  @CheckPolicies((ability) => ability.can('update', 'DocumentTemplate'))
  @AuditLogAction('PLACEHOLDERS_UPDATE')
  async updatePlaceholders(
    @Param('uuid') uuid: string,
    @Body(new ZodValidationPipe(UpdatePlaceholdersSchema))
    body: UpdatePlaceholdersInput,
  ) {
    return this.service.updatePlaceholders(uuid, body);
  }
}
