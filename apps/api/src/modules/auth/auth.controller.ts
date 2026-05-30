import { Controller, Post, Body, Req, Res, UseGuards, UnauthorizedException } from '@nestjs/common';
import type { Response, Request } from 'express';
import { AuthService } from './auth.service';
import { ThrottlerGuard } from '@nestjs/throttler';
import { ZodValidationPipe } from '../../core/pipes/zod-validation.pipe';
import { LoginSchema, ForgotPasswordSchema, ResetPasswordSchema, ChangePasswordSchema } from '@bulog-wms/schema';
import type { LoginInput, ForgotPasswordInput, ResetPasswordInput, ChangePasswordInput } from '@bulog-wms/schema';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { AuditLogAction } from '../audit-log/audit-log.decorator';
import { UseInterceptors } from '@nestjs/common';
import { AuditLogInterceptor } from '../audit-log/audit-log.interceptor';
import { AuditLogService } from '../audit-log/audit-log.service';

@Controller('auth')
@UseInterceptors(AuditLogInterceptor)
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly auditLogService: AuditLogService,
  ) {}

  @UseGuards(ThrottlerGuard)
  @Post('login')
  async login(
    @Body(new ZodValidationPipe(LoginSchema)) body: LoginInput,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const user = await this.authService.validateUser(body.email, body.password);
    
    const ipAddress = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'];
    const ipStr = Array.isArray(ipAddress) ? ipAddress[0] : (ipAddress || undefined);

    if (!user) {
      // Log failed login attempt
      await this.auditLogService.log({
        action: 'LOGIN_FAILED',
        ipAddress: ipStr,
        userAgent,
        details: { email: body.email },
      }).catch((e) => console.error('Failed to log LOGIN_FAILED audit log:', e));

      throw new UnauthorizedException('Email atau password salah');
    }

    const result = await this.authService.login(user, ipStr, userAgent);

    // Set refresh token in HttpOnly cookie
    res.cookie('refresh_token', result.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    // Log successful login
    await this.auditLogService.log({
      actorId: user.id,
      action: 'LOGIN_SUCCESS',
      ipAddress: ipStr,
      userAgent,
    }).catch((e) => console.error('Failed to log LOGIN_SUCCESS audit log:', e));

    return {
      accessToken: result.accessToken,
      user: result.user,
    };
  }

  @Post('refresh')
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const refreshToken = req.cookies?.['refresh_token'];
    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token tidak ditemukan');
    }

    const ipAddress = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'];
    const ipStr = Array.isArray(ipAddress) ? ipAddress[0] : (ipAddress || undefined);

    const result = await this.authService.refresh(refreshToken, ipStr, userAgent);

    res.cookie('refresh_token', result.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return {
      accessToken: result.accessToken,
      user: result.user,
    };
  }

  @UseGuards(JwtAuthGuard)
  @Post('logout')
  async logout(
    @Req() req: any,
    @Res({ passthrough: true }) res: Response,
  ) {
    const refreshToken = req.cookies?.['refresh_token'];
    
    const ipAddress = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'];
    const ipStr = Array.isArray(ipAddress) ? ipAddress[0] : (ipAddress || undefined);

    if (refreshToken) {
      // Perform logout session revocation and audit logging in the background asynchronously
      this.authService.logout(refreshToken, req.user.id).then(async (session) => {
        if (session) {
          await this.auditLogService.log({
            actorId: req.user.id,
            action: 'LOGOUT_SUCCESS',
            ipAddress: ipStr,
            userAgent,
          }).catch((e) => console.error('Failed to log LOGOUT_SUCCESS audit log:', e));
        }
      }).catch((e) => {
        console.error('Error during async logout processing:', e);
      });

      res.clearCookie('refresh_token');
    }

    return { message: 'Logout berhasil' };
  }

  @Post('forgot-password')
  @UseGuards(ThrottlerGuard)
  async forgotPassword(@Body(new ZodValidationPipe(ForgotPasswordSchema)) body: ForgotPasswordInput) {
    return this.authService.forgotPassword(body.email);
  }

  @Post('reset-password')
  async resetPassword(@Body(new ZodValidationPipe(ResetPasswordSchema)) body: ResetPasswordInput) {
    return this.authService.resetPassword(body.token, body.password);
  }

  @UseGuards(JwtAuthGuard)
  @Post('change-password')
  @AuditLogAction('USER_PASSWORD_CHANGE')
  async changePassword(
    @Req() req: any,
    @Body(new ZodValidationPipe(ChangePasswordSchema)) body: ChangePasswordInput,
  ) {
    return this.authService.changePassword(req.user.id, {
      oldPass: body.oldPassword,
      newPass: body.newPassword,
    });
  }

  @UseGuards(JwtAuthGuard)
  @Post('me')
  async me(@Req() req: any) {
    const user = req.user;
    return {
      uuid: user.uuid,
      email: user.email,
      name: user.name,
      isFirstLogin: user.isFirstLogin,
      role: user.role.name,
      permissions: user.role.permissions.map((rp: any) => ({
        action: rp.permission.action,
        subject: rp.permission.subject,
      })),
      warehouse: user.warehouse ? { uuid: user.warehouse.uuid, name: user.warehouse.name } : null,
      accessibleWarehouses: await this.authService.getAccessibleWarehouses(user.id, user.role.name),
    };
  }
}
