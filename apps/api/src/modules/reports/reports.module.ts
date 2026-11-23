import { Module } from '@nestjs/common';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';
import { ReportsAnalyticsController } from './reports-analytics.controller';
import { ReportsAnalyticsService } from './reports-analytics.service';
import { StockFolderService } from './stock-folder.service';
import { ReportsAnalyticsExportService } from './reports-analytics-export.service';
import { BanpangRealizationService } from './banpang-realization.service';
import { BanpangFolderService } from './banpang-folder.service';
import { StackMapService } from './stack-map.service';

@Module({
  controllers: [ReportsController, ReportsAnalyticsController],
  providers: [
    ReportsService,
    ReportsAnalyticsService,
    StockFolderService,
    ReportsAnalyticsExportService,
    BanpangRealizationService,
    BanpangFolderService,
    StackMapService,
  ],
  exports: [ReportsService],
})
export class ReportsModule {}
