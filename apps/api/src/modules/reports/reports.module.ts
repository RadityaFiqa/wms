import { Module } from '@nestjs/common';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';
import { ReportsAnalyticsController } from './reports-analytics.controller';
import { ReportsAnalyticsService } from './reports-analytics.service';
import { StockFolderService } from './stock-folder.service';
import { ReportsAnalyticsExportService } from './reports-analytics-export.service';

@Module({
  controllers: [ReportsController, ReportsAnalyticsController],
  providers: [
    ReportsService,
    ReportsAnalyticsService,
    StockFolderService,
    ReportsAnalyticsExportService,
  ],
  exports: [ReportsService],
})
export class ReportsModule {}
