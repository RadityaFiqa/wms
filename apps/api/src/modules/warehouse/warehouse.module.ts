import { Module } from '@nestjs/common';
import { WarehouseService } from './warehouse.service';
import { WarehouseController } from './warehouse.controller';
import { PrismaModule } from '../../core/prisma/prisma.module';
import { WarehouseContextModule } from '../../core/warehouse-context/warehouse-context.module';

@Module({
  imports: [PrismaModule, WarehouseContextModule],
  controllers: [WarehouseController],
  providers: [WarehouseService],
  exports: [WarehouseService],
})
export class WarehouseModule {}

