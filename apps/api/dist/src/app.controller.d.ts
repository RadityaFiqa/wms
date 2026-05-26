import { AppService } from './app.service';
import { PrismaService } from './core/prisma/prisma.service';
export declare class AppController {
    private readonly appService;
    private readonly prisma;
    constructor(appService: AppService, prisma: PrismaService);
    getHello(): string;
    getWarehouses(): Promise<{
        uuid: string;
        id: number;
        name: string;
        location: string;
        capacity: number;
        createdAt: Date;
        updatedAt: Date;
    }[]>;
}
