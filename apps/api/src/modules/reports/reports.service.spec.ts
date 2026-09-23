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
        create: jest
          .fn()
          .mockImplementation((args) => Promise.resolve(args.data)),
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
        {
          id: locId,
          warehouseId,
          uuid: 'loc-uuid-1',
          displayName: 'Gudang Utama',
        },
      ]);

      // Mock products
      prismaMock.inventory.findMany.mockResolvedValue([
        {
          id: prodId,
          uuid: 'prod-uuid-1',
          sku: 'PRD001',
          name: 'Beras Pack 5 Kg',
          uom: 'Pack',
          quants: [],
        },
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

  describe('resolveProductDocRefAndPartner helper', () => {
    it('Scenario A: 1 GateOperation -> 1 DocumentReference -> 1 Partner', () => {
      const prod = {
        inventoryId: 10,
        documentReference: {
          documentNumber: 'DOC-001',
          partnerName: 'PT Beras Nusantara',
        },
      };
      const gateOp = {
        clientPartner: 'Legacy GateOp Partner',
      };

      const result = (service as any).resolveProductDocRefAndPartner(
        prod,
        gateOp,
      );
      expect(result.partnerName).toBe('PT Beras Nusantara');
      expect(result.documentNumber).toBe('DOC-001');
      expect(result.docRef).toBe(prod.documentReference);
    });

    it('Scenario B: 1 GateOperation -> multiple DocumentReference -> same Partner', () => {
      const docRef1 = {
        documentNumber: 'DOC-001',
        partnerName: 'PT Mitra Bersama',
      };
      const docRef2 = {
        documentNumber: 'DOC-002',
        partnerName: 'PT Mitra Bersama',
      };

      const prod1 = { inventoryId: 10, documentReference: docRef1 };
      const prod2 = { inventoryId: 11, documentReference: docRef2 };

      const res1 = (service as any).resolveProductDocRefAndPartner(prod1);
      const res2 = (service as any).resolveProductDocRefAndPartner(prod2);

      expect(res1.partnerName).toBe('PT Mitra Bersama');
      expect(res1.documentNumber).toBe('DOC-001');
      expect(res2.partnerName).toBe('PT Mitra Bersama');
      expect(res2.documentNumber).toBe('DOC-002');
    });

    it('Scenario C: 1 GateOperation -> multiple DocumentReference -> different Partner (strictly uses DocumentReference.partnerName)', () => {
      const gateOp = {
        uuid: 'gate-op-shared',
        clientPartner: 'Old Common Partner',
      };

      const prodA = {
        inventoryId: 10,
        documentReference: {
          documentNumber: 'DOC-ALFA',
          partnerName: 'PT Sumber Pangan',
        },
      };
      const prodB = {
        inventoryId: 10,
        documentReference: {
          documentNumber: 'DOC-BETA',
          partnerName: 'CV Makmur Sejahtera',
        },
      };

      const resA = (service as any).resolveProductDocRefAndPartner(prodA, gateOp);
      const resB = (service as any).resolveProductDocRefAndPartner(prodB, gateOp);

      expect(resA.partnerName).toBe('PT Sumber Pangan');
      expect(resA.documentNumber).toBe('DOC-ALFA');
      expect(resB.partnerName).toBe('CV Makmur Sejahtera');
      expect(resB.documentNumber).toBe('DOC-BETA');
      expect(resA.partnerName).not.toBe(gateOp.clientPartner);
      expect(resB.partnerName).not.toBe(gateOp.clientPartner);
    });

    it('Scenario D: Junction table resolution fallback when product.documentReference is missing', () => {
      const prod = { inventoryId: 15 };
      const gateOp = {
        documentReferences: [
          {
            documentReference: {
              documentNumber: 'DOC-JUNCTION-1',
              partnerName: 'PT Mitra Junction 1',
              items: [{ inventoryId: 99 }],
            },
          },
          {
            documentReference: {
              documentNumber: 'DOC-JUNCTION-2',
              partnerName: 'PT Mitra Junction 2',
              items: [{ inventoryId: 15 }],
            },
          },
        ],
      };

      const res = (service as any).resolveProductDocRefAndPartner(prod, gateOp);
      expect(res.partnerName).toBe('PT Mitra Junction 2');
      expect(res.documentNumber).toBe('DOC-JUNCTION-2');
    });

    it('Scenario E: Standalone gate operation with no DocumentReference falls back to gateOp.clientPartner', () => {
      const prod = { inventoryId: 10 };
      const gateOp = { clientPartner: 'Internal Transfer Partner' };

      const res = (service as any).resolveProductDocRefAndPartner(prod, gateOp);
      expect(res.partnerName).toBe('Internal Transfer Partner');
      expect(res.documentNumber).toBe('-');
    });
  });

  describe('getDailyStockMovementDetail with multiple DocumentReferences & Partners', () => {
    const warehouseId = 1;
    const locId = 101;
    const prodId = 201;

    beforeEach(() => {
      prismaMock.location.findMany.mockResolvedValue([
        {
          id: locId,
          warehouseId,
          uuid: 'loc-uuid-1',
          displayName: 'Gudang Utama',
        },
      ]);

      prismaMock.inventory.findUnique.mockResolvedValue({
        id: prodId,
        uuid: 'prod-uuid-1',
        sku: 'PRD001',
        name: 'Beras Premium 5kg',
        uom: 'Kg',
        quants: [
          {
            locationId: locId,
            inventoryId: prodId,
            quantity: 5000,
          },
        ],
      });

      prismaMock.quant.findMany.mockResolvedValue([
        {
          locationId: locId,
          inventoryId: prodId,
          quantity: 5000,
        },
      ]);

      prismaMock.dailyLocationStockSnapshot.findMany.mockResolvedValue([]);
      prismaMock.dailyLocationStockSnapshot.findFirst.mockResolvedValue(null);
    });

    it('should separate quantities and partner names for 1 GateOperation with multiple DocumentReferences', async () => {
      // 1 GateOperation containing 2 products with different DocumentReferences and Partners
      const opDate = new Date('2026-06-28T10:00:00+08:00');
      const sharedGateOp = {
        id: 1,
        uuid: 'gate-op-uuid-1',
        opNumber: 'OP-2026-001',
        cardType: 'OUT',
        status: 'VERIFIED',
        createdAt: opDate,
        verifiedAt: opDate,
        driverName: 'Budi Driver',
        licensePlate: 'B 1234 CD',
        clientPartner: 'Legacy Op Partner (Should Be Ignored)',
        products: [
          {
            id: 1001,
            uuid: 'prod-line-1',
            inventoryId: prodId,
            locationId: locId,
            quantity: 350,
            quant: { lotName: 'LOT-A' },
            documentReference: {
              documentNumber: 'DOC-PARTNER-A',
              partnerName: 'PT Partner Sejahtera',
              state: 'assigned',
            },
          },
          {
            id: 1002,
            uuid: 'prod-line-2',
            inventoryId: prodId,
            locationId: locId,
            quantity: 650,
            quant: { lotName: 'LOT-B' },
            documentReference: {
              documentNumber: 'DOC-PARTNER-B',
              partnerName: 'CV Partner Makmur',
              state: 'assigned',
            },
          },
        ],
      };

      prismaMock.gateOperation.findMany
        .mockResolvedValueOnce([sharedGateOp]) // for date range gateOps
        .mockResolvedValueOnce([]) // for activePendingOps
        .mockResolvedValueOnce([]); // for prior gateOps

      prismaMock.documentReference.findMany.mockResolvedValue([]);

      const result = await service.getDailyStockMovementDetail(warehouseId, {
        date: '2026-06-28',
        productUuid: 'prod-uuid-1',
      });

      expect(result).toBeDefined();
      expect(result.date).toBe('2026-06-28');
      expect(result.outgoing).toHaveLength(2);

      const tx1 = result.outgoing.find((t: any) => t.quantity === 350);
      const tx2 = result.outgoing.find((t: any) => t.quantity === 650);

      expect(tx1).toBeDefined();
      expect(tx1.partnerName).toBe('PT Partner Sejahtera');
      expect(tx1.documentNumber).toBe('DOC-PARTNER-A');

      expect(tx2).toBeDefined();
      expect(tx2.partnerName).toBe('CV Partner Makmur');
      expect(tx2.documentNumber).toBe('DOC-PARTNER-B');
    });
  });
});
