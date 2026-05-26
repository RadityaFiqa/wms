import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { AuditLogService } from './audit-log.service';
import { AUDIT_ACTION_KEY } from './audit-log.decorator';

@Injectable()
export class AuditLogInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly auditLogService: AuditLogService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const action = this.reflector.get<string>(AUDIT_ACTION_KEY, context.getHandler());

    if (!action) {
      return next.handle();
    }

    return next.handle().pipe(
      tap({
        next: (data) => {
          const user = request.user;
          const ipAddress = request.ip || request.headers['x-forwarded-for'] || request.socket.remoteAddress;
          const userAgent = request.headers['user-agent'];

          // Safely determine target user ID from path param or response data
          let targetId: number | undefined = undefined;
          
          if (request.params.id) {
            const paramId = parseInt(request.params.id);
            if (!isNaN(paramId)) targetId = paramId;
          }
          
          if (data && typeof data === 'object' && data.id) {
            targetId = data.id;
          }

          // Sanitize body to avoid leaking passwords or tokens
          const sanitizedBody = request.body ? { ...request.body } : undefined;
          if (sanitizedBody) {
            const keysToRedact = ['password', 'confirmPassword', 'oldPassword', 'newPassword', 'confirmNewPassword', 'token'];
            for (const key of keysToRedact) {
              if (sanitizedBody[key]) sanitizedBody[key] = '***REDACTED***';
            }
          }

          this.auditLogService.log({
            actorId: user?.id,
            targetId: targetId,
            action,
            ipAddress: Array.isArray(ipAddress) ? ipAddress[0] : (ipAddress || null),
            userAgent,
            details: {
              body: sanitizedBody,
              params: request.params,
              query: request.query,
            },
          }).catch((err) => console.error('Failed to save audit log in interceptor:', err));
        },
      }),
    );
  }
}
