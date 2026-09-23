import { Test, TestingModule } from '@nestjs/testing';
import { ErpDocumentReferenceService } from './erp-document-reference.service';
import { PrismaService } from '@/core/prisma/prisma.service';
import { OdooClient } from '@/modules/odoo/odoo-client';
import { OdooSessionManager } from '@/modules/odoo/odoo-session.manager';
import { WarehouseContextService } from '@/core/warehouse-context/warehouse-context.service';

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

  it('should support legacy gate operation fallback when documentReferenceId is null', async () => {
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
    expect(doc.pickedQuantityPrimary).toBe(300);
    expect(doc.remainingQuantityPrimary).toBe(700);
    expect(doc.gateOperations[0].quantity).toBe(300);
  });
});
