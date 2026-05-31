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
        warehouse: {
            location: string;
            uuid: string;
            id: number;
            name: string;
            isActive: boolean;
            createdAt: Date;
            updatedAt: Date;
            code: string;
            capacity: number;
            type: string | null;
            address: string | null;
            odooReference: string | null;
        } | null;
    } & {
        uuid: string;
        id: number;
        email: string;
        password: string;
        name: string;
        isActive: boolean;
        isFirstLogin: boolean;
        roleId: number;
        warehouseId: number | null;
        createdAt: Date;
        updatedAt: Date;
    }>;
}
export {};
