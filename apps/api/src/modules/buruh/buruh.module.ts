import { Module } from '@nestjs/common';
import { BuruhController } from '@/modules/buruh/buruh.controller';
import { BuruhService } from '@/modules/buruh/buruh.service';
import { StorageModule } from '@/modules/storage/storage.module';

@Module({
  imports: [StorageModule],
  controllers: [BuruhController],
  providers: [BuruhService],
  exports: [BuruhService],
})
export class BuruhModule {}
