import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type {
  CreateStockFolderInput,
  InboundFolder,
  MoveStockFolderItemInput,
  RenameStockFolderInput,
} from '@bulog-wms/schema';
import { PrismaService } from '@/core/prisma/prisma.service';
import { placementKey } from '@/modules/reports/stock-folder.utils';

export type ProductFolders = {
  folders: (InboundFolder & { id: number })[];
  /** placementKey → folder id (null = kept out of the sender's folder) */
  placements: Map<string, number | null>;
};

const isUniqueViolation = (err: unknown) =>
  err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002';

/** Manual folders per product in the stock inbound grouping, per warehouse */
@Injectable()
export class StockFolderService {
  constructor(private readonly prisma: PrismaService) {}

  /** Folders and placements of every product in the warehouse, by inventory id */
  async getByProduct(
    warehouseId: number,
  ): Promise<Map<number, ProductFolders>> {
    const [folders, items] = await Promise.all([
      this.prisma.stockGroupFolder.findMany({
        where: { warehouseId },
        select: { id: true, uuid: true, name: true, inventoryId: true },
        orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
      }),
      this.prisma.stockGroupFolderItem.findMany({
        where: { warehouseId },
        select: {
          inventoryId: true,
          senderName: true,
          lotName: true,
          folderId: true,
        },
      }),
    ]);

    const result = new Map<number, ProductFolders>();
    const forProduct = (inventoryId: number) => {
      let entry = result.get(inventoryId);
      if (!entry) {
        entry = { folders: [], placements: new Map() };
        result.set(inventoryId, entry);
      }
      return entry;
    };
    for (const f of folders) {
      forProduct(f.inventoryId).folders.push({
        id: f.id,
        uuid: f.uuid,
        name: f.name,
      });
    }
    for (const item of items) {
      forProduct(item.inventoryId).placements.set(
        placementKey(item.senderName, item.lotName || null),
        item.folderId,
      );
    }
    return result;
  }

  async create(
    warehouseId: number,
    input: CreateStockFolderInput,
    userId?: number,
  ): Promise<InboundFolder> {
    const inventoryId = await this.findProductId(input.productUuid);
    const last = await this.prisma.stockGroupFolder.aggregate({
      where: { warehouseId, inventoryId },
      _max: { sortOrder: true },
    });
    try {
      return await this.prisma.stockGroupFolder.create({
        data: {
          warehouseId,
          inventoryId,
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
    input: RenameStockFolderInput,
  ): Promise<InboundFolder> {
    const folder = await this.findFolder(warehouseId, uuid);
    try {
      return await this.prisma.stockGroupFolder.update({
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

  /** Deletes the folder; what was in it goes back to the sender's folder or to none */
  async remove(warehouseId: number, uuid: string) {
    const folder = await this.findFolder(warehouseId, uuid);
    await this.prisma.stockGroupFolder.delete({ where: { id: folder.id } });
    return { uuid: folder.uuid };
  }

  /**
   * Moves a whole sender (with all its lots) or a single lot into a folder, or out of
   * any folder when folderUuid is null.
   */
  async move(warehouseId: number, input: MoveStockFolderItemInput) {
    const inventoryId = await this.findProductId(input.productUuid);
    let folderId: number | null = null;
    if (input.folderUuid) {
      const folder = await this.findFolder(warehouseId, input.folderUuid);
      if (folder.inventoryId !== inventoryId) {
        throw new NotFoundException('Folder tidak ditemukan di produk ini.');
      }
      folderId = folder.id;
    }

    const scope = { warehouseId, inventoryId, senderName: input.senderName };

    if (!input.lotName) {
      // The sender moves as a whole: its lots drop their own placements
      await this.prisma.$transaction(async (tx) => {
        await tx.stockGroupFolderItem.deleteMany({ where: scope });
        if (folderId !== null) {
          await tx.stockGroupFolderItem.create({
            data: { ...scope, lotName: '', folderId },
          });
        }
      });
      return { ok: true };
    }

    const senderItem = await this.prisma.stockGroupFolderItem.findUnique({
      where: {
        warehouseId_inventoryId_senderName_lotName: { ...scope, lotName: '' },
      },
      select: { folderId: true },
    });
    const lotWhere = {
      warehouseId_inventoryId_senderName_lotName: {
        ...scope,
        lotName: input.lotName,
      },
    };
    if ((senderItem?.folderId ?? null) === folderId) {
      // Same place as its sender: no own placement needed
      await this.prisma.stockGroupFolderItem.deleteMany({
        where: { ...scope, lotName: input.lotName },
      });
    } else {
      await this.prisma.stockGroupFolderItem.upsert({
        where: lotWhere,
        update: { folderId },
        create: { ...scope, lotName: input.lotName, folderId },
      });
    }
    return { ok: true };
  }

  private async findProductId(productUuid: string) {
    const product = await this.prisma.inventory.findUnique({
      where: { uuid: productUuid },
      select: { id: true },
    });
    if (!product) throw new NotFoundException('Produk tidak ditemukan.');
    return product.id;
  }

  private async findFolder(warehouseId: number, uuid: string) {
    const folder = await this.prisma.stockGroupFolder.findFirst({
      where: { uuid, warehouseId },
      select: { id: true, uuid: true, inventoryId: true },
    });
    if (!folder) throw new NotFoundException('Folder tidak ditemukan.');
    return folder;
  }
}
