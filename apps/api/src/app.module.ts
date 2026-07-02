import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { ScheduleModule } from '@nestjs/schedule';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './core/prisma/prisma.module';
import { LoggerModule } from './core/logger/logger.module';
import { RedisModule } from './core/redis/redis.module';
import { AuthModule } from './modules/auth/auth.module';
import { UserModule } from './modules/user/user.module';
import { RoleModule } from './modules/role/role.module';
import { CaslModule } from './modules/casl/casl.module';
import { AuditLogModule } from './modules/audit-log/audit-log.module';
import { EmailModule } from './modules/email/email.module';
import { OdooModule } from './modules/odoo/odoo.module';
import { InventoryModule } from './modules/inventory/inventory.module';
import { WarehouseContextModule } from './core/warehouse-context/warehouse-context.module';
import { StorageModule } from './modules/storage/storage.module';
import { GateModule } from './modules/gate/gate.module';
import { ErpDocumentReferenceModule } from './modules/erp-document-reference/erp-document-reference.module';
import { WarehouseModule } from './modules/warehouse/warehouse.module';
import { ReportsModule } from './modules/reports/reports.module';
import { DigitalSignatureModule } from './modules/digital-signature/digital-signature.module';
import { StackCardModule } from './modules/stack-card/stack-card.module';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { WarehouseInterceptor } from './core/warehouse-context/warehouse.interceptor';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    // BullMQ Connection Configuration
    BullModule.forRoot({
      connection: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
      },
    }),
    ScheduleModule.forRoot(),
    LoggerModule,
    PrismaModule,
    RedisModule,
    WarehouseContextModule,
    // Custom Modules
    CaslModule,
    EmailModule,
    AuthModule,
    UserModule,
    RoleModule,
    AuditLogModule,
    OdooModule,
    InventoryModule,
    StorageModule,
    GateModule,
    ErpDocumentReferenceModule,
    WarehouseModule,
    ReportsModule,
    DigitalSignatureModule,
    StackCardModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_INTERCEPTOR,
      useClass: WarehouseInterceptor,
    },
  ],
})
export class AppModule {}
