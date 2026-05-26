import { JwtService } from '@nestjs/jwt';
import { UserService } from '../user/user.service';
import { PrismaService } from '../../core/prisma/prisma.service';
import { EmailService } from '../email/email.service';
export declare class AuthService {
    private readonly userService;
    private readonly jwtService;
    private readonly prisma;
    private readonly emailService;
    constructor(userService: UserService, jwtService: JwtService, prisma: PrismaService, emailService: EmailService);
    validateUser(email: string, pass: string): Promise<any>;
    login(user: any, ipAddress?: string, userAgent?: string): Promise<{
        accessToken: string;
        refreshToken: string;
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
    refresh(refreshToken: string, ipAddress?: string, userAgent?: string): Promise<{
        accessToken: string;
        refreshToken: string;
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
    logout(refreshToken: string): Promise<void>;
    forgotPassword(email: string): Promise<{
        message: string;
    }>;
    resetPassword(token: string, pass: string): Promise<{
        message: string;
    }>;
    changePassword(userId: number, data: {
        oldPass: string;
        newPass: string;
    }): Promise<{
        message: string;
    }>;
}
