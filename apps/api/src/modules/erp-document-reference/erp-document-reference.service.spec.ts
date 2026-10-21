import { Test, TestingModule } from '@nestjs/testing';
import { ErpDocumentReferenceService } from './erp-document-reference.service';
import { PrismaService } from '@/core/prisma/prisma.service';
import { OdooClient } from '@/modules/odoo/odoo-client';
import { OdooSessionManager } from '@/modules/odoo/odoo-session.manager';
import { WarehouseContextService } from '@/core/warehouse-context/warehouse-context.service';
import {
  readStockPickingWithFallback,
  STOCK_PICKING_BASE_SPECIFICATION,
  STOCK_PICKING_SPECIFICATION,
} from '@/modules/odoo/odoo-picking.specification';

describe('ErpDocumentReferenceService - getPendingPickups', () => {
  let service: ErpDocumentReferenceService;
  let prismaMock: any;
  let warehouseContextMock: any;

  beforeEach(async () => {
    prismaMock = {
      documentReference: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      inventory: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      gateOperation: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    };

    warehouseContextMock = {
      getTimezone: jest.fn().mockReturnValue('Asia/Jakarta'),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ErpDocumentReferenceService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: OdooClient, useValue: {} },
        { provide: OdooSessionManager, useValue: {} },
        { provide: WarehouseContextService, useValue: warehouseContextMock },
      ],
    }).compile();

    service = module.get<ErpDocumentReferenceService>(
      ErpDocumentReferenceService,
    );
  });

  it('should compile', () => {
    expect(service).toBeDefined();
  });

  it('should correctly scope GateOperationProduct quantities when 1 GateOperation has multiple DocumentReferences', async () => {
    const warehouseId = 1;
    const prodId = 101;

    // Mock inventory SKU
    prismaMock.inventory.findMany.mockResolvedValue([
      { id: prodId, sku: 'BRS-PREM-5' },
    ]);

    // Shared GateOperation
    const sharedGateOp = {
      id: 50,
      uuid: 'gate-op-50',
      opNumber: 'OP-2026-MULTI',
      createdAt: new Date('2026-06-28T09:00:00Z'),
      status: 'VERIFIED',
    };

    // Document 1 (Partner A)
    const doc1 = {
      id: 1,
      uuid: 'doc-uuid-1',
      warehouseId,
      documentNumber: 'WH/OUT/001',
      partnerName: 'PT Beras Makmur',
      scheduledDate: new Date('2026-06-28T10:00:00Z'),
      origin: 'SO-001',
      driver: 'Supir 1',
      plateNumber: 'B 1111 AA',
      state: 'assigned',
      items: [
        {
          id: 11,
          inventoryId: prodId,
          productName: 'Beras Premium 5kg',
          uom: 'Kg',
          productQty: 1000,
          secondaryUom: null,
          secondaryQuantity: null,
        },
      ],
      // Product assigned to Doc 1 via documentReferenceId
      operationProducts: [
        {
          id: 501,
          inventoryId: prodId,
          quantity: 400,
          gateOperation: sharedGateOp,
        },
      ],
      gateOperations: [],
    };

    // Document 2 (Partner B) on the SAME GateOperation
    const doc2 = {
      id: 2,
      uuid: 'doc-uuid-2',
      warehouseId,
      documentNumber: 'WH/OUT/002',
      partnerName: 'CV Pangan Berkah',
      scheduledDate: new Date('2026-06-28T11:00:00Z'),
      origin: 'SO-002',
      driver: 'Supir 1',
      plateNumber: 'B 1111 AA',
      state: 'assigned',
      items: [
        {
          id: 12,
          inventoryId: prodId,
          productName: 'Beras Premium 5kg',
          uom: 'Kg',
          productQty: 500,
          secondaryUom: null,
          secondaryQuantity: null,
        },
      ],
      // Product assigned to Doc 2 via documentReferenceId
      operationProducts: [
        {
          id: 502,
          inventoryId: prodId,
          quantity: 250,
          gateOperation: sharedGateOp,
        },
      ],
      gateOperations: [],
    };

    prismaMock.documentReference.findMany.mockResolvedValue([doc1, doc2]);

    const result = await service.getPendingPickups(warehouseId, {
      page: 1,
      limit: 10,
    });

    expect(result).toBeDefined();
    expect(result.products).toHaveLength(1);

    const product = result.products[0];
    expect(product.productId).toBe(prodId);
    expect(product.erpQuantityPrimary).toBe(1500); // 1000 + 500
    expect(product.pickedQuantityPrimary).toBe(650); // 400 + 250
    expect(product.remainingQuantityPrimary).toBe(850); // 1500 - 650
    expect(product.documents).toHaveLength(2);

    // Verify Doc 1
    const pDoc1 = product.documents.find((d: any) => d.uuid === 'doc-uuid-1');
    expect(pDoc1).toBeDefined();
    expect(pDoc1.partnerName).toBe('PT Beras Makmur');
    expect(pDoc1.erpQuantityPrimary).toBe(1000);
    expect(pDoc1.pickedQuantityPrimary).toBe(400); // Only line 1 (400), not combined 650
    expect(pDoc1.remainingQuantityPrimary).toBe(600);
    expect(pDoc1.progress).toBe(40);
    expect(pDoc1.gateOperations).toHaveLength(1);
    expect(pDoc1.gateOperations[0].quantity).toBe(400);

    // Verify Doc 2
    const pDoc2 = product.documents.find((d: any) => d.uuid === 'doc-uuid-2');
    expect(pDoc2).toBeDefined();
    expect(pDoc2.partnerName).toBe('CV Pangan Berkah');
    expect(pDoc2.erpQuantityPrimary).toBe(500);
    expect(pDoc2.pickedQuantityPrimary).toBe(250); // Only line 2 (250), not combined 650
    expect(pDoc2.remainingQuantityPrimary).toBe(250);
    expect(pDoc2.progress).toBe(50);
    expect(pDoc2.gateOperations).toHaveLength(1);
    expect(pDoc2.gateOperations[0].quantity).toBe(250);

    // Verify Summary
    expect(result.summary.totalPendingDocuments).toBe(2);
    expect(result.summary.completionRate).toBeCloseTo((650 / 1500) * 100);
  });

  it('should not count unallocated gate lines (documentReferenceId null) as picked for the primary document', async () => {
    const warehouseId = 1;
    const prodId = 202;

    prismaMock.inventory.findMany.mockResolvedValue([
      { id: prodId, sku: 'GULA-PASIR-1' },
    ]);

    const legacyGateOp = {
      id: 88,
      uuid: 'gate-op-88',
      opNumber: 'OP-LEGACY',
      createdAt: new Date('2026-06-25T10:00:00Z'),
      status: 'VERIFIED',
      products: [
        {
          id: 881,
          inventoryId: prodId,
          quantity: 300,
          documentReferenceId: null,
        },
      ],
    };

    const docLegacy = {
      id: 9,
      uuid: 'doc-legacy-uuid',
      warehouseId,
      documentNumber: 'WH/OUT/LEGACY',
      partnerName: 'PT Mitra Lama',
      scheduledDate: new Date('2026-06-25T12:00:00Z'),
      state: 'assigned',
      items: [
        {
          id: 91,
          inventoryId: prodId,
          productName: 'Gula Pasir 1kg',
          uom: 'Kg',
          productQty: 1000,
          secondaryUom: null,
          secondaryQuantity: null,
        },
      ],
      operationProducts: [],
      gateOperations: [legacyGateOp],
    };

    prismaMock.documentReference.findMany.mockResolvedValue([docLegacy]);

    const result = await service.getPendingPickups(warehouseId, {});
    expect(result.products).toHaveLength(1);

    const doc = result.products[0].documents[0];
    expect(doc.pickedQuantityPrimary).toBe(0);
    expect(doc.remainingQuantityPrimary).toBe(1000);
    expect(doc.gateOperations).toHaveLength(0);
  });

  describe('upsertDocumentRecord - WMS picking move lines', () => {
    const loc = (id: number, name: string) => ({ id, display_name: name });
    const line = (
      id: number,
      src: any,
      dest: any,
      lot: string,
      qty: number,
      picking: string,
    ) => ({
      id,
      picking_id: { id: id * 10, display_name: picking },
      product_id: { id: 101, display_name: 'Beras' },
      location_id: src,
      location_dest_id: dest,
      lot_id: { id: id * 100, display_name: lot },
      quantity: qty,
      date: '2026-10-20 03:00:00',
    });

    const buildTx = () => ({
      documentReference: {
        upsert: jest
          .fn()
          .mockImplementation((args) =>
            Promise.resolve({ id: args.where.id, ...args.create }),
          ),
      },
      documentReferenceItem: {
        upsert: jest.fn().mockResolvedValue({}),
        deleteMany: jest.fn().mockResolvedValue({}),
      },
      documentReferenceMoveLine: {
        deleteMany: jest.fn().mockResolvedValue({}),
        createMany: jest.fn().mockResolvedValue({}),
      },
    });

    it('uses the chained Pick move lines for outgoing documents', async () => {
      const tx = buildTx();
      const record = {
        id: 900,
        name: 'WH/OUT/0001',
        state: 'done',
        picking_type_code: 'outgoing',
        location_id: loc(5, 'WH/Output'),
        location_dest_id: loc(9, 'Partners/Customers'),
        move_ids_without_package: [
          {
            id: 7001,
            product_id: { id: 101, display_name: 'Beras' },
            quantity: 100,
            product_qty: 100,
            move_line_ids: [
              line(
                1,
                loc(5, 'WH/Output'),
                loc(9, 'Partners/Customers'),
                'OUT-LOT',
                100,
                'WH/OUT/0001',
              ),
            ],
            move_orig_ids: [
              {
                id: 6001,
                state: 'done',
                move_line_ids: [
                  line(
                    2,
                    loc(21, 'WH/Stock/Tumpukan A'),
                    loc(5, 'WH/Output'),
                    'STACK-A',
                    60,
                    'WH/PICK/0001',
                  ),
                  line(
                    3,
                    loc(22, 'WH/Stock/Tumpukan B'),
                    loc(5, 'WH/Output'),
                    'STACK-B',
                    40,
                    'WH/PICK/0001',
                  ),
                ],
              },
            ],
          },
        ],
      };

      await service.upsertDocumentRecord(tx, record, 1);

      const created =
        tx.documentReferenceMoveLine.createMany.mock.calls[0][0].data;
      expect(created).toHaveLength(2);
      expect(created[0]).toMatchObject({
        erpMoveLineId: 2,
        documentReferenceId: 900,
        documentReferenceItemId: 7001,
        sourceLocationId: 21,
        lotName: 'STACK-A',
        pickingName: 'WH/PICK/0001',
        quantity: 60,
      });
      const header = tx.documentReference.upsert.mock.calls[0][0].create;
      expect(header.sourceLocationName).toBe(
        'WH/Stock/Tumpukan A, WH/Stock/Tumpukan B',
      );
      expect(header.destinationLocationName).toBe('Partners/Customers');
    });

    it('falls back to own move lines when the chained move is not done', async () => {
      const tx = buildTx();
      const record = {
        id: 901,
        name: 'WH/OUT/0002',
        state: 'done',
        picking_type_code: 'outgoing',
        location_id: loc(21, 'WH/Stock/Tumpukan A'),
        location_dest_id: loc(9, 'Partners/Customers'),
        move_ids_without_package: [
          {
            id: 7002,
            product_id: { id: 101, display_name: 'Beras' },
            quantity: 10,
            product_qty: 10,
            move_line_ids: [
              line(
                4,
                loc(21, 'WH/Stock/Tumpukan A'),
                loc(9, 'Partners/Customers'),
                'STACK-A',
                10,
                'WH/OUT/0002',
              ),
            ],
            move_orig_ids: [{ id: 6002, state: 'assigned', move_line_ids: [] }],
          },
        ],
      };

      await service.upsertDocumentRecord(tx, record, 1);

      const created =
        tx.documentReferenceMoveLine.createMany.mock.calls[0][0].data;
      expect(created).toHaveLength(1);
      expect(created[0]).toMatchObject({
        erpMoveLineId: 4,
        sourceLocationId: 21,
      });
    });
  });

  describe('upsertDocumentRecord - WMS picking_ids / putaway_ids', () => {
    const loc = (id: number, name: string) => ({ id, display_name: name });
    const product = { id: 101, display_name: 'Beras' };
    const line = (
      id: number,
      src: any,
      dest: any,
      lot: string,
      qty: number,
    ) => ({
      id,
      picking_id: { id: 8436220, display_name: 'WH/OUT/0001' },
      product_id: product,
      location_id: src,
      location_dest_id: dest,
      lot_id: { id: id * 100, display_name: lot },
      quantity: qty,
      date: '2026-10-20 03:00:00',
    });
    const buildTx = () => ({
      documentReference: {
        upsert: jest
          .fn()
          .mockImplementation((args) =>
            Promise.resolve({ id: args.where.id, ...args.create }),
          ),
      },
      documentReferenceItem: {
        upsert: jest.fn().mockResolvedValue({}),
        deleteMany: jest.fn().mockResolvedValue({}),
      },
      documentReferenceMoveLine: {
        deleteMany: jest.fn().mockResolvedValue({}),
        createMany: jest.fn().mockResolvedValue({}),
      },
    });
    const docItem = (id: number, ownLine: any) => ({
      id,
      product_id: product,
      quantity: 100,
      product_qty: 100,
      move_line_ids: [ownLine],
    });

    it('uses done vit.picking move lines (picking_ids) for outgoing documents', async () => {
      const tx = buildTx();
      await service.upsertDocumentRecord(
        tx,
        {
          id: 910,
          name: 'WH/OUT/0001',
          state: 'done',
          picking_type_code: 'outgoing',
          location_id: loc(5, 'WH/Output'),
          location_dest_id: loc(9, 'Partners/Customers'),
          move_ids_without_package: [
            docItem(
              7101,
              line(
                1,
                loc(5, 'WH/Output'),
                loc(9, 'Partners/Customers'),
                'X',
                100,
              ),
            ),
          ],
          picking_ids: [
            {
              id: 566240,
              name: 'PICK/0001',
              state: 'done',
              move_ids: [
                {
                  id: 11451894,
                  state: 'done',
                  product_id: product,
                  move_line_ids: [
                    line(
                      2,
                      loc(618205, 'WH/Stock/Tumpukan 1'),
                      loc(5, 'WH/Output'),
                      'STACK-1',
                      70,
                    ),
                    line(
                      3,
                      loc(542119, 'WH/Stock/Tumpukan 2'),
                      loc(5, 'WH/Output'),
                      'STACK-2',
                      30,
                    ),
                  ],
                },
                {
                  id: 11451895,
                  state: 'cancel',
                  product_id: product,
                  move_line_ids: [
                    line(4, loc(1, 'x'), loc(5, 'WH/Output'), 'Z', 99),
                  ],
                },
              ],
            },
          ],
        },
        1,
      );

      const created =
        tx.documentReferenceMoveLine.createMany.mock.calls[0][0].data;
      expect(
        created.map((l: any) => [
          l.erpMoveLineId,
          l.sourceLocationId,
          l.lotName,
          l.quantity,
          l.pickingName,
        ]),
      ).toEqual([
        [2, 618205, 'STACK-1', 70, 'PICK/0001'],
        [3, 542119, 'STACK-2', 30, 'PICK/0001'],
      ]);
      expect(
        tx.documentReference.upsert.mock.calls[0][0].create.sourceLocationName,
      ).toBe('WH/Stock/Tumpukan 1, WH/Stock/Tumpukan 2');
    });

    it('uses done putaway move lines (putaway_ids) for incoming documents', async () => {
      const tx = buildTx();
      await service.upsertDocumentRecord(
        tx,
        {
          id: 911,
          name: 'WH/IN/0001',
          state: 'done',
          picking_type_code: 'incoming',
          location_id: loc(8, 'Partners/Vendors'),
          location_dest_id: loc(6, 'WH/Input'),
          move_ids_without_package: [
            docItem(
              7102,
              line(5, loc(8, 'Partners/Vendors'), loc(6, 'WH/Input'), 'X', 100),
            ),
          ],
          putaway_ids: [
            {
              id: 777,
              name: 'PUT/0001',
              state: 'done',
              move_ids: [
                {
                  id: 888,
                  state: 'done',
                  product_id: product,
                  move_line_ids: [
                    line(
                      6,
                      loc(6, 'WH/Input'),
                      loc(837950, 'WH/Stock/Tumpukan 5'),
                      'STACK-5',
                      100,
                    ),
                  ],
                },
              ],
            },
          ],
        },
        1,
      );

      const created =
        tx.documentReferenceMoveLine.createMany.mock.calls[0][0].data;
      expect(created).toHaveLength(1);
      expect(created[0]).toMatchObject({
        destinationLocationId: 837950,
        lotName: 'STACK-5',
        pickingName: 'PUT/0001',
      });
      expect(
        tx.documentReference.upsert.mock.calls[0][0].create
          .destinationLocationName,
      ).toBe('WH/Stock/Tumpukan 5');
    });
  });

  describe('readStockPickingWithFallback', () => {
    it('retries with the base specification when Odoo rejects a WMS field', async () => {
      const read = jest
        .fn()
        .mockRejectedValueOnce(
          new Error(
            "Odoo RPC Error: Invalid field 'putaway_ids' on model 'stock.picking'",
          ),
        )
        .mockResolvedValueOnce(['ok']);
      const onFallback = jest.fn();

      await expect(
        readStockPickingWithFallback(read, onFallback),
      ).resolves.toEqual(['ok']);
      expect(read.mock.calls[0][0]).toBe(STOCK_PICKING_SPECIFICATION);
      expect(read.mock.calls[1][0]).toBe(STOCK_PICKING_BASE_SPECIFICATION);
      expect(onFallback).toHaveBeenCalled();
    });

    it('rethrows other Odoo errors', async () => {
      const read = jest.fn().mockRejectedValue(new Error('Session expired'));
      await expect(readStockPickingWithFallback(read)).rejects.toThrow(
        'Session expired',
      );
      expect(read).toHaveBeenCalledTimes(1);
    });
  });
});
