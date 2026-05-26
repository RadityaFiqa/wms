import { Controller, Get, Post, Put, Body, Param, Query, UseGuards, UseInterceptors } from '@nestjs/common';
import { UserService } from './user.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PoliciesGuard } from '../casl/policies.guard';
import { CheckPolicies } from '../casl/policies.decorator';
import { AuditLogInterceptor } from '../audit-log/audit-log.interceptor';
import { AuditLogAction } from '../audit-log/audit-log.decorator';
import { CreateUserSchema, UpdateUserSchema } from '@bulog-wms/schema';
import type { CreateUserInput, UpdateUserInput } from '@bulog-wms/schema';
import { ZodValidationPipe } from '../../core/pipes/zod-validation.pipe';

@Controller('users')
@UseGuards(JwtAuthGuard, PoliciesGuard)
@UseInterceptors(AuditLogInterceptor)
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Post()
  @CheckPolicies((ability) => ability.can('create', 'User'))
  @AuditLogAction('USER_CREATE')
  async create(@Body(new ZodValidationPipe(CreateUserSchema)) body: CreateUserInput) {
    return this.userService.create(body);
  }

  @Get()
  @CheckPolicies((ability) => ability.can('read', 'User'))
  async findAll(
    @Query('search') search?: string,
    @Query('roleId') roleId?: number,
    @Query('isActive') isActive?: boolean,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.userService.findAll({ search, roleId, isActive, page, limit });
  }

  @Get(':uuid')
  @CheckPolicies((ability) => ability.can('read', 'User'))
  async findOne(@Param('uuid') uuid: string) {
    return this.userService.findByUuid(uuid);
  }

  @Put(':uuid')
  @CheckPolicies((ability) => ability.can('update', 'User'))
  @AuditLogAction('USER_UPDATE')
  async update(
    @Param('uuid') uuid: string,
    @Body(new ZodValidationPipe(UpdateUserSchema)) body: UpdateUserInput,
  ) {
    return this.userService.update(uuid, body);
  }

  @Post(':uuid/deactivate')
  @CheckPolicies((ability) => ability.can('update', 'User'))
  @AuditLogAction('USER_DEACTIVATE')
  async deactivate(@Param('uuid') uuid: string) {
    return this.userService.toggleStatus(uuid, false);
  }

  @Post(':uuid/activate')
  @CheckPolicies((ability) => ability.can('update', 'User'))
  @AuditLogAction('USER_REACTIVATE')
  async activate(@Param('uuid') uuid: string) {
    return this.userService.toggleStatus(uuid, true);
  }

  @Post(':uuid/reset-password')
  @CheckPolicies((ability) => ability.can('update', 'User'))
  @AuditLogAction('USER_PASSWORD_RESET')
  async resetPassword(@Param('uuid') uuid: string) {
    return this.userService.adminResetPassword(uuid);
  }
}
