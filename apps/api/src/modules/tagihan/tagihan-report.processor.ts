import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { PrismaService } from '@/core/prisma/prisma.service';
import { TagihanReportService } from './tagihan-report.service';

@Processor('tagihan-reports')
export class TagihanReportProcessor extends WorkerHost {
  private readonly logger = new Logger(TagihanReportProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly reportService: TagihanReportService,
  ) {
    super();
  }

  async process(job: Job<any>): Promise<any> {
    const { jobUuid, reportType, tagihanUuid } = job.data;
    this.logger.log(
      `Processing report job: ID=${job.id}, UUID=${jobUuid}, type=${reportType}, tagihan=${tagihanUuid}`,
    );

    try {
      return await this.reportService.processJobExecution(job.data);
    } catch (err: any) {
      this.logger.error(
        `Report job failed for ${jobUuid}: ${err.message}`,
        err.stack,
      );

      // Record failure state in database so frontend polling receives the exact error
      await this.prisma.tagihanReportJob
        .update({
          where: { uuid: jobUuid },
          data: {
            status: 'FAILED',
            stage: 'FAILED',
            errorMessage: err.message || 'Gagal menghasilkan berkas laporan.',
            completedAt: new Date(),
          },
        })
        .catch((e) =>
          this.logger.error(`Failed to update job status to FAILED: ${e.message}`),
        );

      throw err;
    }
  }
}
