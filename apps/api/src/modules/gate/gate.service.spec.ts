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
        aggregate: jest.fn().mockResolvedValue({ _sum: { quantity: 0 } }),
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
});
