import { Injectable, NotFoundException } from '@nestjs/common';
import type {
  SaveStackMapAreaInput,
  SaveStackMapLabelInput,
  StackMapArea,
  StackMapLabel,
  StackMapSettingsResponse,
} from '@bulog-wms/schema';
import { PrismaService } from '@/core/prisma/prisma.service';

const labelSelect = {
  title: true,
  note: true,
  hidden: true,
  updatedAt: true,
  location: { select: { uuid: true } },
  updatedBy: { select: { name: true } },
} as const;

type LabelRow = {
  title: string;
  note: string;
  hidden: boolean;
  updatedAt: Date;
  location: { uuid: string };
  updatedBy: { name: string } | null;
};

const toLabel = (row: LabelRow): StackMapLabel => ({
  locationUuid: row.location.uuid,
  title: row.title,
  note: row.note,
  hidden: row.hidden,
  updatedAt: row.updatedAt.toISOString(),
  updatedBy: row.updatedBy?.name ?? null,
});

/**
 * Peta tumpukan settings, per warehouse: the title and note of each stack and the
 * row order of each area. The stock itself comes from the stock inbound grouping.
 */
@Injectable()
export class StackMapService {
  constructor(private readonly prisma: PrismaService) {}

  async getSettings(warehouseId: number): Promise<StackMapSettingsResponse> {
    const [areas, labels] = await Promise.all([
      this.prisma.stackMapArea.findMany({
        where: { warehouseId },
        select: { area: true, descending: true },
        orderBy: { area: 'asc' },
      }),
      this.prisma.stackMapLabel.findMany({
        where: { warehouseId },
        select: labelSelect,
      }),
    ]);
    return { areas, labels: labels.map(toLabel) };
  }

  /** Saves the title, note and hidden flag of a stack; a shown stack without title and note drops its row */
  async saveLabel(
    warehouseId: number,
    input: SaveStackMapLabelInput,
    userId?: number,
  ): Promise<StackMapLabel | null> {
    const location = await this.prisma.location.findFirst({
      where: { uuid: input.locationUuid, warehouseId },
      select: { id: true },
    });
    if (!location) throw new NotFoundException('Tumpukan tidak ditemukan.');

    const key = { warehouseId, locationId: location.id };
    if (!input.title && !input.note && !input.hidden) {
      await this.prisma.stackMapLabel.deleteMany({ where: key });
      return null;
    }
    const data = {
      title: input.title,
      note: input.note,
      hidden: input.hidden,
      updatedById: userId ?? null,
    };
    const row = await this.prisma.stackMapLabel.upsert({
      where: { warehouseId_locationId: key },
      update: data,
      create: { ...key, ...data },
      select: labelSelect,
    });
    return toLabel(row);
  }

  async saveArea(
    warehouseId: number,
    input: SaveStackMapAreaInput,
  ): Promise<StackMapArea> {
    return this.prisma.stackMapArea.upsert({
      where: { warehouseId_area: { warehouseId, area: input.area } },
      update: { descending: input.descending },
      create: { warehouseId, area: input.area, descending: input.descending },
      select: { area: true, descending: true },
    });
  }
}
