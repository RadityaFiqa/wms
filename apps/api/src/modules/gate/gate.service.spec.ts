import { Test, TestingModule } from '@nestjs/testing';
import { GateService } from './gate.service';
import { PrismaService } from '../../core/prisma/prisma.service';
import { WarehouseContextService } from '../../core/warehouse-context/warehouse-context.service';
import { StorageService } from '../storage/storage.service';
import { ConfigService } from '@nestjs/config';
import { AuditLogService } from '../audit-log/audit-log.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { CardType } from '@prisma/client';

describe('GateService - Bulk Operations', () => {
  let service: GateService;
  let prismaMock: any;
  let warehouseContextMock: any;
  let storageServiceMock: any;
  let configServiceMock: any;
  let auditLogServiceMock: any;

  beforeEach(async () => {
    prismaMock = {
      gateOperation: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      gateOperationProduct: {
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn().mockResolvedValue(null),
        aggregate: jest.fn().mockResolvedValue({ _sum: { quantity: 0 } }),
        update: jest.fn(),
        create: jest.fn(),
        delete: jest.fn(),
      },
      documentReferenceItem: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      $queryRawUnsafe: jest.fn().mockResolvedValue([]),
      gateOperationDocumentReference: {
        create: jest.fn(),
        deleteMany: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn().mockResolvedValue(null),
      },
      documentReference: {
        findUnique: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
      },
      fileAttachment: {
        updateMany: jest.fn(),
      },
      $transaction: jest.fn().mockImplementation((cb) => cb(prismaMock)),
    };

    warehouseContextMock = {
      getTimezone: jest.fn().mockReturnValue('Asia/Makassar'),
      getWarehouseId: jest.fn().mockReturnValue(1),
    };

    storageServiceMock = {
      getFilePublicUrl: jest.fn().mockReturnValue('http://mockurl'),
      getFilePrivateUrl: jest.fn().mockReturnValue('http://mockurl'),
    };

    configServiceMock = {
      get: jest.fn(),
    };

    auditLogServiceMock = {
      log: jest.fn().mockResolvedValue(null),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GateService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: WarehouseContextService, useValue: warehouseContextMock },
        { provide: StorageService, useValue: storageServiceMock },
        { provide: ConfigService, useValue: configServiceMock },
        { provide: AuditLogService, useValue: auditLogServiceMock },
      ],
    }).compile();

    service = module.get<GateService>(GateService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('bulkApprove', () => {
    it('should successfully approve eligible gate operations', async () => {
      const mockOp = {
        id: 1,
        uuid: 'op-uuid-1',
        status: 'PENDING',
        documentReferenceId: 10,
        products: [],
      };

      // Mock database calls inside confirmGateVerification
      prismaMock.gateOperation.findUnique.mockResolvedValue(mockOp);
      jest
        .spyOn(service, 'confirmGateVerification')
        .mockResolvedValue(mockOp as any);

      const result = await service.bulkApprove(['op-uuid-1'], 99);

      expect(result.successCount).toBe(1);
      expect(result.failedCount).toBe(0);
      expect(result.results[0]).toEqual({ id: 'op-uuid-1', success: true });
      expect(auditLogServiceMock.log).toHaveBeenCalledWith({
        actorId: 99,
        action: 'GATE_OPERATION_CONFIRM',
        details: {
          operationUuid: 'op-uuid-1',
          bulk: true,
        },
      });
    });

    it('should report failure for non-existent gate operations', async () => {
      prismaMock.gateOperation.findUnique.mockResolvedValue(null);

      const result = await service.bulkApprove(['non-existent-uuid'], 99);

      expect(result.successCount).toBe(0);
      expect(result.failedCount).toBe(1);
      expect(result.results[0].success).toBe(false);
      expect(result.results[0].message).toContain('tidak ditemukan');
    });

    it('should report failure for gate operations not in PENDING status', async () => {
      const mockOp = {
        id: 1,
        uuid: 'op-uuid-1',
        status: 'VERIFIED',
        documentReferenceId: 10,
        products: [],
      };
      prismaMock.gateOperation.findUnique.mockResolvedValue(mockOp);

      const result = await service.bulkApprove(['op-uuid-1'], 99);

      expect(result.successCount).toBe(0);
      expect(result.failedCount).toBe(1);
      expect(result.results[0].success).toBe(false);
      expect(result.results[0].message).toContain('tidak dalam status PENDING');
    });

    it('should report failure for gate operations with missing reference documents', async () => {
      const mockOp = {
        id: 1,
        uuid: 'op-uuid-1',
        status: 'PENDING',
        documentReferenceId: null,
        products: [],
      };
      prismaMock.gateOperation.findUnique.mockResolvedValue(mockOp);

      const result = await service.bulkApprove(['op-uuid-1'], 99);

      expect(result.successCount).toBe(0);
      expect(result.failedCount).toBe(1);
      expect(result.results[0].success).toBe(false);
      expect(result.results[0].message).toContain(
        'Dokumen referensi tidak ditemukan',
      );
    });

    it('should support partial success if some operations succeed and others fail', async () => {
      const mockOp1 = {
        id: 1,
        uuid: 'op-uuid-1',
        status: 'PENDING',
        documentReferenceId: 10,
        products: [],
      };
      const mockOp2 = {
        id: 2,
        uuid: 'op-uuid-2',
        status: 'PENDING',
        documentReferenceId: null, // Fail (missing doc ref)
        products: [],
      };

      prismaMock.gateOperation.findUnique
        .mockResolvedValueOnce(mockOp1)
        .mockResolvedValueOnce(mockOp2);

      jest
        .spyOn(service, 'confirmGateVerification')
        .mockResolvedValue(mockOp1 as any);

      const result = await service.bulkApprove(['op-uuid-1', 'op-uuid-2'], 99);

      expect(result.successCount).toBe(1);
      expect(result.failedCount).toBe(1);
      expect(result.results[0]).toEqual({ id: 'op-uuid-1', success: true });
      expect(result.results[1].success).toBe(false);
      expect(result.results[1].message).toContain(
        'Dokumen referensi tidak ditemukan',
      );
    });
  });

  describe('bulkReject', () => {
    it('should successfully reject eligible gate operations and release reservations', async () => {
      const mockOp = {
        id: 1,
        uuid: 'op-uuid-1',
        status: 'PENDING',
        cardType: CardType.IN,
        documentReferenceId: 10,
        products: [{ quantId: 200, quantity: 50 }],
      };

      prismaMock.gateOperation.findUnique.mockResolvedValue(mockOp);

      const result = await service.bulkReject(
        ['op-uuid-1'],
        'Barang rusak',
        99,
      );

      expect(result.successCount).toBe(1);
      expect(result.failedCount).toBe(0);
      expect(result.results[0]).toEqual({ id: 'op-uuid-1', success: true });
      expect(prismaMock.gateOperation.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: {
          status: 'REJECTED',
          verifiedById: 99,
          verifiedAt: expect.any(Date),
          verificationNotes: 'Barang rusak',
        },
      });
      expect(auditLogServiceMock.log).toHaveBeenCalledWith({
        actorId: 99,
        action: 'GATE_OPERATION_REJECT',
        details: {
          operationUuid: 'op-uuid-1',
          reason: 'Barang rusak',
          bulk: true,
        },
      });
    });

    it('should throw an error if the rejection reason is empty', async () => {
      await expect(
        service.bulkReject(['op-uuid-1'], '   ', 99),
      ).rejects.toThrow(BadRequestException);
    });

    it('should report failure for gate operations with missing reference documents during rejection', async () => {
      const mockOp = {
        id: 1,
        uuid: 'op-uuid-1',
        status: 'PENDING',
        documentReferenceId: null,
        products: [],
      };
      prismaMock.gateOperation.findUnique.mockResolvedValue(mockOp);

      const result = await service.bulkReject(
        ['op-uuid-1'],
        'Alasan penolakan',
        99,
      );

      expect(result.successCount).toBe(0);
      expect(result.failedCount).toBe(1);
      expect(result.results[0].success).toBe(false);
      expect(result.results[0].message).toContain(
        'Dokumen referensi tidak ditemukan',
      );
    });
  });

  describe('Multiple Document References', () => {
    describe('attachDocumentReference', () => {
      it('should throw NotFoundException if gate operation does not exist', async () => {
        prismaMock.gateOperation.findUnique.mockResolvedValue(null);
        await expect(
          service.attachDocumentReference('invalid-uuid', 10),
        ).rejects.toThrow(NotFoundException);
      });

      it('should throw BadRequestException if gate operation is already VERIFIED', async () => {
        prismaMock.gateOperation.findUnique.mockResolvedValue({
          id: 1,
          uuid: 'op-1',
          status: 'VERIFIED',
          documentReferences: [],
        });
        await expect(
          service.attachDocumentReference('op-1', 10),
        ).rejects.toThrow(BadRequestException);
      });

      it('should throw NotFoundException if document reference does not exist', async () => {
        prismaMock.gateOperation.findUnique.mockResolvedValue({
          id: 1,
          uuid: 'op-1',
          status: 'PENDING',
          documentReferences: [],
        });
        prismaMock.documentReference.findUnique.mockResolvedValue(null);
        await expect(
          service.attachDocumentReference('op-1', 999),
        ).rejects.toThrow(NotFoundException);
      });

      it('should throw BadRequestException if document is already attached', async () => {
        prismaMock.gateOperation.findUnique.mockResolvedValue({
          id: 1,
          uuid: 'op-1',
          status: 'PENDING',
          warehouseId: 1,
          documentReferenceId: 30,
        });
        prismaMock.documentReference.findUnique.mockResolvedValue({
          id: 10,
          warehouseId: 1,
          documentNumber: 'DOC-10',
        });
        prismaMock.gateOperationDocumentReference.findFirst.mockResolvedValue({
          gateOperationId: 1,
          documentReferenceId: 10,
        });
        await expect(
          service.attachDocumentReference('op-1', 10),
        ).rejects.toThrow(BadRequestException);
        expect(
          prismaMock.gateOperationDocumentReference.create,
        ).not.toHaveBeenCalled();
      });

      it('should throw NotFoundException if document belongs to another warehouse', async () => {
        prismaMock.gateOperation.findUnique.mockResolvedValue({
          id: 1,
          uuid: 'op-1',
          status: 'PENDING',
          warehouseId: 1,
        });
        prismaMock.documentReference.findUnique.mockResolvedValue({
          id: 20,
          warehouseId: 2,
        });
        await expect(
          service.attachDocumentReference('op-1', 20),
        ).rejects.toThrow(NotFoundException);
      });

      it('should successfully attach document reference and create junction record', async () => {
        prismaMock.gateOperation.findUnique.mockResolvedValue({
          id: 1,
          uuid: 'op-1',
          status: 'PENDING',
          warehouseId: 1,
          documentReferenceId: 10,
        });
        prismaMock.documentReference.findUnique.mockResolvedValue({
          id: 20,
          warehouseId: 1,
          documentNumber: 'DOC-20',
        });
        prismaMock.gateOperationDocumentReference.create.mockResolvedValue({
          id: 2,
          gateOperationId: 1,
          documentReferenceId: 20,
        });
        jest.spyOn(service, 'getGateOperationByUuid').mockResolvedValue({
          uuid: 'op-1',
        } as any);

        const result = await service.attachDocumentReference('op-1', 20);
        expect(
          prismaMock.gateOperationDocumentReference.create,
        ).toHaveBeenCalledWith({
          data: {
            gateOperationId: 1,
            documentReferenceId: 20,
          },
        });
        expect(result).toBeDefined();
      });
    });

    describe('automatic allocation on attach', () => {
      const unallocated = (id: number, quantity: number) => ({
        id,
        inventoryId: 5,
        quantity,
        notes: null,
        quantId: 7,
        locationId: 8,
        documentReferenceId: null,
        inventory: { uom: 'Lembar' },
      });

      const attachWith = async (
        docId: number,
        docQty: number,
        lines: any[],
        docUom = 'Lembar',
      ) => {
        prismaMock.gateOperation.findUnique.mockResolvedValue({
          id: 1,
          uuid: 'op-1',
          status: 'PENDING',
          warehouseId: 1,
          documentReferenceId: 99,
        });
        prismaMock.documentReference.findUnique.mockResolvedValue({
          id: docId,
          warehouseId: 1,
        });
        prismaMock.gateOperationProduct.findMany.mockResolvedValue(lines);
        prismaMock.documentReferenceItem.findMany.mockResolvedValue([
          { inventoryId: 5, uom: docUom, productQty: docQty, quantity: docQty },
        ]);
        jest
          .spyOn(service, 'getGateOperationByUuid')
          .mockResolvedValue({ uuid: 'op-1' } as any);
        await service.attachDocumentReference('op-1', docId);
      };

      it('allocates MIN(document qty, remaining) by splitting the unallocated line (65.710 Lembar example)', async () => {
        // Doc A 3.000 -> 3.000 allocated, 62.710 remaining
        await attachWith(10, 3000, [unallocated(100, 65710)]);
        expect(prismaMock.gateOperationProduct.update).toHaveBeenCalledWith({
          where: { id: 100 },
          data: { quantity: 62710 },
        });
        expect(prismaMock.gateOperationProduct.create).toHaveBeenCalledWith({
          data: {
            gateOperationId: 1,
            inventoryId: 5,
            quantity: 3000,
            notes: null,
            quantId: 7,
            locationId: 8,
            documentReferenceId: 10,
          },
        });

        // Doc B 60.000 -> 60.000 allocated, 2.710 remaining
        jest.clearAllMocks();
        await attachWith(11, 60000, [unallocated(100, 62710)]);
        expect(prismaMock.gateOperationProduct.update).toHaveBeenCalledWith({
          where: { id: 100 },
          data: { quantity: 2710 },
        });
        expect(prismaMock.gateOperationProduct.create).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              quantity: 60000,
              documentReferenceId: 11,
            }),
          }),
        );

        // Doc C 5.000 -> only 2.710 allocated: the whole remaining line is linked, 0 remaining
        jest.clearAllMocks();
        await attachWith(12, 5000, [unallocated(100, 2710)]);
        expect(prismaMock.gateOperationProduct.update).toHaveBeenCalledWith({
          where: { id: 100 },
          data: { documentReferenceId: 12 },
        });
        expect(prismaMock.gateOperationProduct.create).not.toHaveBeenCalled();
      });

      it('caps allocation by the remaining document quantity realized elsewhere', async () => {
        prismaMock.gateOperationProduct.aggregate.mockResolvedValue({
          _sum: { quantity: 1000 },
        });
        await attachWith(10, 3000, [unallocated(100, 65710)]);
        expect(prismaMock.gateOperationProduct.create).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({ quantity: 2000 }),
          }),
        );
      });

      it('does not add a line when nothing remains unallocated', async () => {
        await attachWith(12, 5000, [
          { ...unallocated(101, 65710), documentReferenceId: 10 },
        ]);
        expect(prismaMock.gateOperationProduct.create).not.toHaveBeenCalled();
        expect(prismaMock.gateOperationProduct.update).not.toHaveBeenCalled();
      });

      it('does not allocate when the unit of measure differs', async () => {
        await attachWith(10, 3000, [unallocated(100, 65710)], 'Kg');
        expect(prismaMock.gateOperationProduct.create).not.toHaveBeenCalled();
        expect(prismaMock.gateOperationProduct.update).not.toHaveBeenCalled();
      });

      it('does not allocate the same document twice for a product', async () => {
        await attachWith(10, 3000, [
          unallocated(100, 62710),
          { ...unallocated(101, 3000), documentReferenceId: 10 },
        ]);
        expect(prismaMock.gateOperationProduct.create).not.toHaveBeenCalled();
        expect(prismaMock.gateOperationProduct.update).not.toHaveBeenCalled();
      });
    });

    describe('removeDocumentReference', () => {
      it('should throw BadRequestException if operation is VERIFIED', async () => {
        prismaMock.gateOperation.findUnique.mockResolvedValue({
          id: 1,
          uuid: 'op-1',
          status: 'VERIFIED',
          documentReferences: [],
          products: [],
        });
        await expect(
          service.removeDocumentReference('op-1', 10),
        ).rejects.toThrow(BadRequestException);
      });

      it('should return allocated quantity to the unallocated line with the same stack', async () => {
        prismaMock.gateOperation.findUnique.mockResolvedValue({
          id: 1,
          uuid: 'op-1',
          status: 'PENDING',
          documentReferenceId: 10,
        });
        prismaMock.gateOperationProduct.findMany.mockResolvedValue([
          {
            id: 101,
            inventoryId: 5,
            quantity: 3000,
            quantId: 7,
            locationId: 8,
            documentReferenceId: 20,
          },
        ]);
        prismaMock.gateOperationProduct.findFirst.mockResolvedValue({
          id: 100,
          quantity: 62710,
        });
        jest.spyOn(service, 'getGateOperationByUuid').mockResolvedValue({
          uuid: 'op-1',
        } as any);

        await service.removeDocumentReference('op-1', 20);
        expect(prismaMock.gateOperationProduct.update).toHaveBeenCalledWith({
          where: { id: 100 },
          data: { quantity: 65710 },
        });
        expect(prismaMock.gateOperationProduct.delete).toHaveBeenCalledWith({
          where: { id: 101 },
        });
      });

      it('should unlink allocated line when no matching unallocated line exists', async () => {
        prismaMock.gateOperation.findUnique.mockResolvedValue({
          id: 1,
          uuid: 'op-1',
          status: 'PENDING',
          documentReferenceId: 10,
        });
        prismaMock.gateOperationProduct.findMany.mockResolvedValue([
          { id: 101, inventoryId: 5, quantity: 3000, documentReferenceId: 20 },
        ]);
        jest.spyOn(service, 'getGateOperationByUuid').mockResolvedValue({
          uuid: 'op-1',
        } as any);

        await service.removeDocumentReference('op-1', 20);
        expect(prismaMock.gateOperationProduct.update).toHaveBeenCalledWith({
          where: { id: 101 },
          data: { documentReferenceId: null },
        });
      });

      it('should successfully remove document reference and update primary if needed', async () => {
        prismaMock.gateOperation.findUnique.mockResolvedValue({
          id: 1,
          uuid: 'op-1',
          status: 'PENDING',
          documentReferenceId: 10,
          documentReferences: [
            { documentReferenceId: 10 },
            { documentReferenceId: 20 },
          ],
          products: [],
        });
        prismaMock.gateOperationDocumentReference.findFirst.mockResolvedValue({
          documentReferenceId: 20,
        });
        jest.spyOn(service, 'getGateOperationByUuid').mockResolvedValue({
          uuid: 'op-1',
        } as any);

        await service.removeDocumentReference('op-1', 10);
        expect(
          prismaMock.gateOperationDocumentReference.deleteMany,
        ).toHaveBeenCalledWith({
          where: {
            gateOperationId: 1,
            documentReferenceId: 10,
          },
        });
        expect(prismaMock.gateOperation.update).toHaveBeenCalledWith({
          where: { id: 1 },
          data: { documentReferenceId: 20 },
        });
      });
    });
  });
});
