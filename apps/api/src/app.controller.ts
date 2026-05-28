import { Controller, Get, UseGuards, Req } from '@nestjs/common';
import { AppService } from './app.service';
import { PrismaService } from './core/prisma/prisma.service';
import { JwtAuthGuard } from './modules/auth/guards/jwt-auth.guard';
import { WarehouseGuard } from './core/warehouse-context/warehouse.guard';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly prisma: PrismaService,
  ) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @UseGuards(JwtAuthGuard, WarehouseGuard)
  @Get('warehouses')
  async getWarehouses(@Req() req: any) {
    const user = req.user;
    const roleName = user.role?.name || user.role;

    if (roleName === 'SUPER_ADMIN') {
      return this.prisma.warehouse.findMany({
        orderBy: { name: 'asc' },
      });
    }

    const accesses = await this.prisma.userWarehouseAccess.findMany({
      where: { userId: user.id },
      include: { warehouse: true },
      orderBy: { warehouse: { name: 'asc' } } as any,
    });

    return accesses.map((acc) => acc.warehouse);
  }
}
