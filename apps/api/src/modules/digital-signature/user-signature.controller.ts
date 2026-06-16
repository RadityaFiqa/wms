import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  ParseIntPipe,
  Req,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { UserSignatureService } from './user-signature.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { WarehouseGuard } from '../../core/warehouse-context/warehouse.guard';
import { PoliciesGuard } from '../casl/policies.guard';
import { CheckPolicies } from '../casl/policies.decorator';
import { AuditLogInterceptor } from '../audit-log/audit-log.interceptor';
import { AuditLogAction } from '../audit-log/audit-log.decorator';

@Controller('user-signatures')
@UseGuards(JwtAuthGuard, WarehouseGuard, PoliciesGuard)
@UseInterceptors(AuditLogInterceptor)
export class UserSignatureController {
  constructor(private readonly service: UserSignatureService) {}

  @Post()
  @UseInterceptors(FileInterceptor('file'))
  @CheckPolicies((ability) => ability.can('manage', 'UserSignature'))
  @AuditLogAction('USER_SIGNATURE_UPLOAD')
  async upload(@Req() req: any, @UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('File tanda tangan wajib diunggah.');
    }

    // Limit to 2MB
    const maxSize = 2 * 1024 * 1024;
    if (file.size > maxSize) {
      throw new BadRequestException('Ukuran file tidak boleh melebihi 2MB.');
    }

    const userId = req.user.id;
    return this.service.create(userId, file);
  }

  @Get()
  @CheckPolicies((ability) => ability.can('manage', 'UserSignature'))
  async findAll(@Req() req: any) {
    const userId = req.user.id;
    return this.service.findAll(userId);
  }

  @Get('active')
  @CheckPolicies((ability) => ability.can('manage', 'UserSignature'))
  async findActive(@Req() req: any) {
    const userId = req.user.id;
    return this.service.findActive(userId);
  }

  @Post(':id/activate')
  @CheckPolicies((ability) => ability.can('manage', 'UserSignature'))
  @AuditLogAction('USER_SIGNATURE_ACTIVATE')
  async activate(@Req() req: any, @Param('id', ParseIntPipe) id: number) {
    const userId = req.user.id;
    return this.service.setActive(id, userId);
  }

  @Delete(':id')
  @CheckPolicies((ability) => ability.can('manage', 'UserSignature'))
  @AuditLogAction('USER_SIGNATURE_DELETE')
  async remove(@Req() req: any, @Param('id', ParseIntPipe) id: number) {
    const userId = req.user.id;
    return this.service.remove(id, userId);
  }
}
