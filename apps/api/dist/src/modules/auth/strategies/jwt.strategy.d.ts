import { Strategy } from 'passport-jwt';
import { UserService } from '../../user/user.service';
declare const JwtStrategy_base: new (...args: [opt: import("passport-jwt").StrategyOptionsWithRequest] | [opt: import("passport-jwt").StrategyOptionsWithoutRequest]) => Strategy & {
    validate(...args: any[]): unknown;
};
export declare class JwtStrategy extends JwtStrategy_base {
    private readonly userService;
    constructor(userService: UserService);
    validate(payload: {
        email: string;
        sub: number;
    }): Promise<{
        warehouse: {
            uuid: string;
            id: number;
            name: string;
            location: string;
            capacity: number;
            createdAt: Date;
            updatedAt: Date;
        } | null;
        role: {
            permissions: ({
                permission: {
                    uuid: string;
                    id: number;
                    createdAt: Date;
                    updatedAt: Date;
                    action: string;
                    subject: string;
                    conditions: string | null;
                };
            } & {
                roleId: number;
                permissionId: number;
            })[];
        } & {
            uuid: string;
            id: number;
            name: string;
            createdAt: Date;
            updatedAt: Date;
            description: string | null;
        };
    } & {
        uuid: string;
        id: number;
        name: string;
        createdAt: Date;
        updatedAt: Date;
        roleId: number;
        email: string;
        password: string;
        isActive: boolean;
        isFirstLogin: boolean;
        warehouseId: number | null;
    }>;
}
export {};
