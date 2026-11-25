import { Module } from '@nestjs/common';
import { OdooModule } from '@/modules/odoo/odoo.module';
import { CaslModule } from '@/modules/casl/casl.module';
import { WarehouseContextModule } from '@/core/warehouse-context/warehouse-context.module';
import { SpkPerawatanController } from '@/modules/spk-perawatan/spk-perawatan.controller';
import { SpkPerawatanService } from '@/modules/spk-perawatan/spk-perawatan.service';

@Module({
  imports: [OdooModule, CaslModule, WarehouseContextModule],
  controllers: [SpkPerawatanController],
  providers: [SpkPerawatanService],
})
export class SpkPerawatanModule {}
