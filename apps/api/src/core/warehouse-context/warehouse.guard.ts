import { Injectable, CanActivate, ExecutionContext, ForbiddenException, BadRequestException } from '@nestjs/common';
import { WarehouseResolver } from './warehouse.resolver';

@Injectable()
export class WarehouseGuard implements CanActivate {
  constructor(private readonly warehouseResolver: WarehouseResolver) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    // If not logged in, pass (let auth guards handle it if protected)
    if (!user) {
      return true;
    }

    const warehouseIdHeader = request.headers['x-warehouse-id'] as string;
    if (!warehouseIdHeader) {
      return true;
    }

    const warehouse = (await this.warehouseResolver.resolveWarehouse(warehouseIdHeader)) as any;
    if (!warehouse) {
      throw new BadRequestException('Warehouse tidak valid');
    }

    const roleName = user.role?.name || user.role;
    if (!warehouse.isActive && roleName !== 'SUPER_ADMIN') {
      throw new ForbiddenException('Gudang (Warehouse) ini sedang tidak aktif.');
    }

    const hasAccess = await this.warehouseResolver.validateUserAccess(user.id, warehouse.id, roleName);
    
    if (!hasAccess) {
      throw new ForbiddenException('Anda tidak memiliki akses ke warehouse ini');
    }

    request.warehouse = warehouse;
    return true;
  }
}
