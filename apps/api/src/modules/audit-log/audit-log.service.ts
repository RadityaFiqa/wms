import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../core/prisma/prisma.service';

@Injectable()
export class AuditLogService {
  constructor(private readonly prisma: PrismaService) {}

  async log(data: {
    actorId?: number;
    targetId?: number;
    action: string;
    ipAddress?: string;
    userAgent?: string;
    details?: any;
  }) {
    return this.prisma.auditLog.create({
      data: {
        actorId: data.actorId || null,
        targetId: data.targetId || null,
        action: data.action,
        ipAddress: data.ipAddress || null,
        userAgent: data.userAgent || null,
        details: data.details ? JSON.stringify(data.details) : null,
      },
    });
  }

  async findAll(query: {
    search?: string;
    action?: string;
    page?: number;
    limit?: number;
  }) {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 10;
    const skip = (page - 1) * limit;

    const where: any = {};

    if (query.action) {
      where.action = query.action;
    }

    if (query.search) {
      where.OR = [
        { actor: { name: { contains: query.search, mode: 'insensitive' } } },
        { actor: { email: { contains: query.search, mode: 'insensitive' } } },
        { target: { name: { contains: query.search, mode: 'insensitive' } } },
        { target: { email: { contains: query.search, mode: 'insensitive' } } },
        { action: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const [total, data] = await Promise.all([
      this.prisma.auditLog.count({ where }),
      this.prisma.auditLog.findMany({
        where,
        skip,
        take: limit,
        orderBy: { timestamp: 'desc' },
        include: {
          actor: { select: { id: true, uuid: true, email: true, name: true } },
          target: { select: { id: true, uuid: true, email: true, name: true } },
        },
      }),
    ]);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}
