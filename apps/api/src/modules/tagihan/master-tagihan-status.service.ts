import {
  Injectable,
  OnModuleInit,
  Logger,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '@/core/prisma/prisma.service';
import type {
  CreateMasterTagihanStatusInput,
  UpdateMasterTagihanStatusInput,
} from '@bulog-wms/schema';

@Injectable()
export class MasterTagihanStatusService implements OnModuleInit {
  private readonly logger = new Logger(MasterTagihanStatusService.name);

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    await this.seedDefaultStatuses();
  }

  /**
   * Ensure standard default Tagihan statuses exist in the database.
   */
  async seedDefaultStatuses() {
    try {
      const defaultStatuses = [
        { name: 'Draft', description: 'Tagihan baru dibuat / konsep', color: 'slate', isDefault: true },
        { name: 'Diajukan', description: 'Tagihan telah diajukan untuk verifikasi', color: 'blue', isDefault: false },
        { name: 'Disetujui', description: 'Tagihan telah diverifikasi dan disetujui', color: 'amber', isDefault: false },
        { name: 'Dibayar', description: 'Tagihan telah lunas dibayarkan', color: 'emerald', isDefault: false },
        { name: 'Dibatalkan', description: 'Tagihan dibatalkan', color: 'red', isDefault: false },
      ];

      for (const st of defaultStatuses) {
        const existing = await this.prisma.masterTagihanStatus.findUnique({
          where: { name: st.name },
        });

        if (!existing) {
          await this.prisma.masterTagihanStatus.create({
            data: st,
          });
          this.logger.log(`Initialized default MasterTagihanStatus: ${st.name}`);
        }
      }
    } catch (err: any) {
      this.logger.warn(`Failed to seed default Tagihan statuses: ${err.message}`);
    }
  }

  /**
   * List all MasterTagihanStatus records.
   */
  async findAll() {
    const list = await this.prisma.masterTagihanStatus.findMany({
      orderBy: { id: 'asc' },
    });

    return list.map((item) => this.sanitize(item));
  }

  /**
   * Find single status by UUID.
   */
  async findByUuid(uuid: string) {
    const status = await this.prisma.masterTagihanStatus.findUnique({
      where: { uuid },
    });

    if (!status) {
      throw new NotFoundException('Status Tagihan tidak ditemukan.');
    }

    return this.sanitize(status);
  }

  /**
   * Create new status.
   */
  async create(data: CreateMasterTagihanStatusInput) {
    const existing = await this.prisma.masterTagihanStatus.findUnique({
      where: { name: data.name },
    });

    if (existing) {
      throw new BadRequestException(`Status "${data.name}" sudah ada.`);
    }

    const created = await this.prisma.masterTagihanStatus.create({
      data: {
        name: data.name,
        description: data.description,
        color: data.color || 'blue',
        isDefault: data.isDefault || false,
      },
    });

    return this.sanitize(created);
  }

  /**
   * Update status by UUID.
   */
  async update(uuid: string, data: UpdateMasterTagihanStatusInput) {
    const status = await this.prisma.masterTagihanStatus.findUnique({
      where: { uuid },
    });

    if (!status) {
      throw new NotFoundException('Status Tagihan tidak ditemukan.');
    }

    const updated = await this.prisma.masterTagihanStatus.update({
      where: { uuid },
      data: {
        ...(data.name ? { name: data.name } : {}),
        ...(data.description !== undefined ? { description: data.description } : {}),
        ...(data.color ? { color: data.color } : {}),
        ...(data.isDefault !== undefined ? { isDefault: data.isDefault } : {}),
      },
    });

    return this.sanitize(updated);
  }

  /**
   * Sanitize MasterTagihanStatus to omit internal numerical ID.
   */
  public sanitize(status: any) {
    if (!status) return null;
    const { id, ...safe } = status;
    return safe;
  }
}
