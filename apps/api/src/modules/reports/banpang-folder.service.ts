import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type {
  BanpangFolder,
  BanpangFolderNameInput,
  MoveBanpangSalesOrderInput,
} from '@bulog-wms/schema';
import { PrismaService } from '@/core/prisma/prisma.service';
import {
  placementKey,
  type BanpangFolders,
} from '@/modules/reports/banpang-realization.utils';

const isUniqueViolation = (err: unknown) =>
  err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002';

/** Manual folders grouping the kecamatan + sales order rows of the Banpang realization, per warehouse */
@Injectable()
export class BanpangFolderService {
  constructor(private readonly prisma: PrismaService) {}

  /** Folders in their order and where each kecamatan + sales order row was placed */
  async getFolders(warehouseId: number): Promise<BanpangFolders> {
    const [folders, items] = await Promise.all([
      this.prisma.banpangFolder.findMany({
        where: { warehouseId },
        select: { uuid: true, name: true },
        orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
      }),
      this.prisma.banpangFolderItem.findMany({
        where: { warehouseId },
        select: {
          soNumber: true,
          pickingRef: true,
          folder: { select: { uuid: true } },
        },
      }),
    ]);
    return {
      folders,
      placements: new Map(
        items.map((i) => [
          placementKey(i.soNumber, i.pickingRef),
          i.folder.uuid,
        ]),
      ),
    };
  }

  async create(
    warehouseId: number,
    input: BanpangFolderNameInput,
    userId?: number,
  ): Promise<BanpangFolder> {
    const last = await this.prisma.banpangFolder.aggregate({
      where: { warehouseId },
      _max: { sortOrder: true },
    });
    try {
      return await this.prisma.banpangFolder.create({
        data: {
          warehouseId,
          name: input.name,
          sortOrder: (last._max.sortOrder ?? 0) + 1,
          createdById: userId,
        },
        select: { uuid: true, name: true },
      });
    } catch (err) {
      if (isUniqueViolation(err)) {
        throw new ConflictException('Folder dengan nama ini sudah ada.');
      }
      throw err;
    }
  }

  async rename(
    warehouseId: number,
    uuid: string,
    input: BanpangFolderNameInput,
  ): Promise<BanpangFolder> {
    const folder = await this.findFolder(warehouseId, uuid);
    try {
      return await this.prisma.banpangFolder.update({
        where: { id: folder.id },
        data: { name: input.name },
        select: { uuid: true, name: true },
      });
    } catch (err) {
      if (isUniqueViolation(err)) {
        throw new ConflictException('Folder dengan nama ini sudah ada.');
      }
      throw err;
    }
  }

  /** Deletes the folder; its sales orders go back to "Belum dikelompokkan" */
  async remove(warehouseId: number, uuid: string) {
    const folder = await this.findFolder(warehouseId, uuid);
    await this.prisma.banpangFolder.delete({ where: { id: folder.id } });
    return { uuid: folder.uuid };
  }

  /**
   * Moves a kecamatan + sales order row into a folder, or out of any folder when
   * folderUuid is null
   */
  async move(warehouseId: number, input: MoveBanpangSalesOrderInput) {
    const pair = {
      warehouseId,
      soNumber: input.soNumber,
      pickingRef: input.destination,
    };
    if (!input.folderUuid) {
      await this.prisma.banpangFolderItem.deleteMany({ where: pair });
      return { ok: true };
    }
    const folder = await this.findFolder(warehouseId, input.folderUuid);
    await this.prisma.banpangFolderItem.upsert({
      where: { warehouseId_soNumber_pickingRef: pair },
      update: { folderId: folder.id },
      create: { ...pair, folderId: folder.id },
    });
    return { ok: true };
  }

  private async findFolder(warehouseId: number, uuid: string) {
    const folder = await this.prisma.banpangFolder.findFirst({
      where: { uuid, warehouseId },
      select: { id: true, uuid: true },
    });
    if (!folder) throw new NotFoundException('Folder tidak ditemukan.');
    return folder;
  }
}
