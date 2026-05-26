import type { Response, Request } from 'express';
import { AuthService } from './auth.service';
import type { LoginInput, ForgotPasswordInput, ResetPasswordInput, ChangePasswordInput } from '@bulog-wms/schema';
import { AuditLogService } from '../audit-log/audit-log.service';
export declare class AuthController {
    private readonly authService;
    private readonly auditLogService;
    constructor(authService: AuthService, auditLogService: AuditLogService);
    login(body: LoginInput, req: Request, res: Response): Promise<{
        accessToken: string;
        user: {
            uuid: any;
            email: any;
            name: any;
            isFirstLogin: any;
            role: any;
            permissions: any;
            warehouse: {
                uuid: any;
                name: any;
            } | null;
        };
    }>;
    refresh(req: Request, res: Response): Promise<{
        accessToken: string;
        user: {
            uuid: any;
            email: any;
            name: any;
            isFirstLogin: any;
            role: any;
            permissions: any;
            warehouse: {
                uuid: any;
                name: any;
            } | null;
        };
    }>;
    logout(req: Request, res: Response): Promise<{
        message: string;
    }>;
    forgotPassword(body: ForgotPasswordInput): Promise<{
        message: string;
    }>;
    resetPassword(body: ResetPasswordInput): Promise<{
        message: string;
    }>;
    changePassword(req: any, body: ChangePasswordInput): Promise<{
        message: string;
    }>;
    me(req: any): Promise<{
        uuid: any;
        email: any;
        name: any;
        isFirstLogin: any;
        role: any;
        permissions: any;
        warehouse: {
            uuid: any;
            name: any;
        } | null;
    }>;
}
