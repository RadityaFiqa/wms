import { Test, TestingModule } from '@nestjs/testing';
import { ReportsService } from './reports.service';
import { PrismaService } from '../../core/prisma/prisma.service';
import { WarehouseContextService } from '../../core/warehouse-context/warehouse-context.service';
import { BadRequestException } from '@nestjs/common';

describe('ReportsService - Stock Mutation Running Balance', () => {
  let service: ReportsService;
  let prismaMock: any;
  let warehouseContextMock: any;

  beforeEach(async () => {
    prismaMock = {
      gateOperation: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      gateOperationProduct: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      documentReference: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      inventory: {
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn(),
      },
      dailyLocationStockSnapshot: {
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockImplementation((args) => Promise.resolve(args.data)),
      },
      location: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      quant: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    };

    warehouseContextMock = {
      getTimezone: jest.fn().mockReturnValue('Asia/Makassar'),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReportsService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: WarehouseContextService, useValue: warehouseContextMock },
      ],
    }).compile();

    service = module.get<ReportsService>(ReportsService);
  });

  it('should compile', () => {
    expect(service).toBeDefined();
  });

  describe('getDailyStockMovementReport', () => {
    const warehouseId = 1;
    const locId = 101;
    const prodId = 201;
    const timezone = 'Asia/Makassar';

    beforeEach(() => {
      // Mock locations
      prismaMock.location.findMany.mockResolvedValue([
        { id: locId, warehouseId, uuid: 'loc-uuid-1', displayName: 'Gudang Utama' },
      ]);

      // Mock products
      prismaMock.inventory.findMany.mockResolvedValue([
        { id: prodId, uuid: 'prod-uuid-1', sku: 'PRD001', name: 'Beras Pack 5 Kg', uom: 'Pack', quants: [] },
      ]);
    });

    it('Case 1 & 2: should calculate forward running balance correctly using a prior snapshot', async () => {
      // Prior snapshot on 25 Jun 2026: closing stock 10,204
      prismaMock.dailyLocationStockSnapshot.findFirst.mockResolvedValue({
        id: 1,
        date: new Date('2026-06-25T00:00:00+08:00'),
        warehouseId,
        locationId: locId,
        inventoryId: prodId,
        closingStock: 10204,
      });

      // Transactions:
      // 1. 26 Jun 2026: Outbound 7,522
      // 2. 29 Jun 2026: Inbound 20,000
      // 3. 29 Jun 2026: Outbound 1,400
      prismaMock.gateOperation.findMany
        .mockResolvedValueOnce([
          // OUT on 26 Jun
          {
            uuid: 'op-1',
            opNumber: 'OP-001',
            cardType: 'OUT',
            status: 'VERIFIED',
            createdAt: new Date('2026-06-26T10:00:00+08:00'),
            products: [
              {
                inventoryId: prodId,
                locationId: locId,
                quantity: 7522,
              },
            ],
          },
          // IN on 29 Jun
          {
            uuid: 'op-2',
            opNumber: 'OP-002',
            cardType: 'IN',
            status: 'VERIFIED',
            verifiedAt: new Date('2026-06-29T08:00:00+08:00'),
            products: [
              {
                inventoryId: prodId,
                locationId: locId,
                quantity: 20000,
              },
            ],
          },
          // OUT on 29 Jun
          {
            uuid: 'op-3',
            opNumber: 'OP-003',
            cardType: 'OUT',
            status: 'VERIFIED',
            createdAt: new Date('2026-06-29T14:00:00+08:00'),
            products: [
              {
                inventoryId: prodId,
                locationId: locId,
                quantity: 1400,
              },
            ],
          },
        ])
        .mockResolvedValueOnce([]);

      const result = await service.getDailyStockMovementReport(warehouseId, {
        startDate: '2026-06-26',
        endDate: '2026-06-29',
      });

      // We expect two dates with movements: 26 Jun and 29 Jun (since 27/28 have no movements and are skipped)
      // Sorted reverse chronologically by default: [29 Jun, 26 Jun]
      expect(result).toHaveLength(2);

      const row29 = result[0];
      const row26 = result[1];

      expect(row26.date).toBe('2026-06-26');
      expect(row26.openingStock).toBe(10204);
      expect(row26.incoming).toBe(0);
      expect(row26.outgoing).toBe(7522);
      expect(row26.closingStock).toBe(2682);

      expect(row29.date).toBe('2026-06-29');
      expect(row29.openingStock).toBe(2682); // Opening 29 Jun = Closing 26 Jun
      expect(row29.incoming).toBe(20000);
      expect(row29.outgoing).toBe(1400);
      expect(row29.closingStock).toBe(21282); // 2682 + 20000 - 1400 = 21282
    });

    it('should fallback to backward calculation from today real stock if no prior snapshot exists', async () => {
      // Mock NO snapshot prior to startDate
      prismaMock.dailyLocationStockSnapshot.findFirst.mockResolvedValue(null);

      // Today is 29 Jun 2026. Mock current physical stock: Quant = 21282 in inventory quants
      prismaMock.inventory.findMany.mockResolvedValue([
        {
          id: prodId,
          uuid: 'prod-uuid-1',
          sku: 'PRD001',
          name: 'Beras Pack 5 Kg',
          uom: 'Pack',
          quants: [
            {
              locationId: locId,
              inventoryId: prodId,
              quantity: 21282,
            },
          ],
        },
      ]);

      // Transactions:
      // 1. 26 Jun 2026: Outbound 7,522
      // 2. 29 Jun 2026: Inbound 20,000
      // 3. 29 Jun 2026: Outbound 1,400
      prismaMock.gateOperation.findMany
        .mockResolvedValueOnce([
          // OUT on 26 Jun
          {
            uuid: 'op-1',
            opNumber: 'OP-001',
            cardType: 'OUT',
            status: 'VERIFIED',
            createdAt: new Date('2026-06-26T10:00:00+08:00'),
            products: [
              {
                inventoryId: prodId,
                locationId: locId,
                quantity: 7522,
              },
            ],
          },
          // IN on 29 Jun
          {
            uuid: 'op-2',
            opNumber: 'OP-002',
            cardType: 'IN',
            status: 'VERIFIED',
            verifiedAt: new Date('2026-06-29T08:00:00+08:00'),
            products: [
              {
                inventoryId: prodId,
                locationId: locId,
                quantity: 20000,
              },
            ],
          },
          // OUT on 29 Jun
          {
            uuid: 'op-3',
            opNumber: 'OP-003',
            cardType: 'OUT',
            status: 'VERIFIED',
            createdAt: new Date('2026-06-29T14:00:00+08:00'),
            products: [
              {
                inventoryId: prodId,
                locationId: locId,
                quantity: 1400,
              },
            ],
          },
        ])
        .mockResolvedValueOnce([]);

      const result = await service.getDailyStockMovementReport(warehouseId, {
        startDate: '2026-06-26',
        endDate: '2026-06-29',
      });

      expect(result).toHaveLength(2);

      const row29 = result[0];
      const row26 = result[1];

      expect(row26.date).toBe('2026-06-26');
      expect(row26.openingStock).toBe(10204); // 21282 + 1400 - 20000 + 7522 = 10204
      expect(row26.incoming).toBe(0);
      expect(row26.outgoing).toBe(7522);
      expect(row26.closingStock).toBe(2682);

      expect(row29.date).toBe('2026-06-29');
      expect(row29.openingStock).toBe(2682);
      expect(row29.incoming).toBe(20000);
      expect(row29.outgoing).toBe(1400);
      expect(row29.closingStock).toBe(21282);
    });
  });
});
