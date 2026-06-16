import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  UseGuards,
  UseInterceptors,
  Req,
} from '@nestjs/common';
import { UserService } from './user.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { WarehouseGuard } from '../../core/warehouse-context/warehouse.guard';
import { PoliciesGuard } from '../casl/policies.guard';
import { CheckPolicies } from '../casl/policies.decorator';
import { AuditLogInterceptor } from '../audit-log/audit-log.interceptor';
import { AuditLogAction } from '../audit-log/audit-log.decorator';
import { CreateUserSchema, UpdateUserSchema } from '@bulog-wms/schema';
import type { CreateUserInput, UpdateUserInput } from '@bulog-wms/schema';
import { ZodValidationPipe } from '../../core/pipes/zod-validation.pipe';

@Controller('users')
@UseGuards(JwtAuthGuard, WarehouseGuard, PoliciesGuard)
@UseInterceptors(AuditLogInterceptor)
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Post()
  @CheckPolicies((ability) => ability.can('create', 'User'))
  @AuditLogAction('USER_CREATE')
  async create(
    @Req() req: any,
    @Body(new ZodValidationPipe(CreateUserSchema)) body: CreateUserInput,
  ) {
    return this.userService.create(body, req.user);
  }

  @Get()
  @CheckPolicies((ability) => ability.can('read', 'User'))
  async findAll(
    @Req() req: any,
    @Query('search') search?: string,
    @Query('roleId') roleId?: number,
    @Query('isActive') isActive?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.userService.findAll(
      { search, roleId, isActive, page, limit },
      req.user,
    );
  }

  @Get(':uuid')
  @CheckPolicies((ability) => ability.can('read', 'User'))
  async findOne(@Param('uuid') uuid: string, @Req() req: any) {
    return this.userService.findByUuid(uuid, req.user);
  }

  @Put(':uuid')
  @CheckPolicies((ability) => ability.can('update', 'User'))
  @AuditLogAction('USER_UPDATE')
  async update(
    @Param('uuid') uuid: string,
    @Body(new ZodValidationPipe(UpdateUserSchema)) body: UpdateUserInput,
    @Req() req: any,
  ) {
    return this.userService.update(uuid, body, req.user);
  }

  @Post(':uuid/deactivate')
  @CheckPolicies((ability) => ability.can('update', 'User'))
  @AuditLogAction('USER_DEACTIVATE')
  async deactivate(@Param('uuid') uuid: string, @Req() req: any) {
    return this.userService.toggleStatus(uuid, false, req.user);
  }

  @Post(':uuid/activate')
  @CheckPolicies((ability) => ability.can('update', 'User'))
  @AuditLogAction('USER_REACTIVATE')
  async activate(@Param('uuid') uuid: string, @Req() req: any) {
    return this.userService.toggleStatus(uuid, true, req.user);
  }

  @Post(':uuid/reset-password')
  @CheckPolicies((ability) => ability.can('update', 'User'))
  @AuditLogAction('USER_PASSWORD_RESET')
  async resetPassword(@Param('uuid') uuid: string, @Req() req: any) {
    return this.userService.adminResetPassword(uuid, req.user);
  }
}
