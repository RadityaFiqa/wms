import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '@/core/prisma/prisma.service';
import { StorageService } from '@/modules/storage/storage.service';
import { DocumentGenerationService } from '@/modules/document/document-generation.service';
import {
  TAGIHAN_EDITABLE_KEYS,
  TAGIHAN_PURPOSE_LABELS,
  allocationDifference,
  canonicalTagihanKey,
  checkTagihanTemplateTags,
  expandToTemplateKeys,
  formatBulanTahunId,
  formatNumberId,
  formatPeriodeId,
  formatTanggalId,
  getSecondaryQty,
  suggestNextNomorSurat,
  terbilangRupiah,
  toRupiahInteger,
  type GenerateSuratPermohonanInput,
  type GenerateTandaTerimaInput,
  type TagihanDocumentPrefill,
  type TagihanDocumentPurpose,
  type TagihanDocumentTemplateOption,
  type TagihanGeneratedDocumentItem,
} from '@bulog-wms/schema';
import type { Prisma } from '@prisma/client';

// A PROCESSING generation without a heartbeat for this long is treated as stuck
const STUCK_AFTER_MS = 10 * 60 * 1000;

// Remembered per warehouse from the last Tanda Terima
const TT_REMEMBERED_KEYS = ['nama_gudang', 'kanwil', 'kota', 'kepala_gudang'];

// Odoo product names carry an internal code prefix, e.g. "[A0080037Z] JAGUNG ..."
const productLabel = (name: string) => name.replace(/^\[[^\]]*\]\s*/, '').trim();

type TagihanForDocuments = Prisma.TagihanGetPayload<{
  include: {
    summaries: true;
    warehouse: { select: { name: true } };
    documentReferences: {
      include: {
        documentReference: {
          select: {
            dateDone: true;
            scheduledDate: true;
            refFax: true;
            items: { select: { productName: true; uom: true } };
          };
        };
      };
    };
  };
}>;

@Injectable()
export class TagihanDocumentService {
  private readonly logger = new Logger(TagihanDocumentService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService,
    private readonly documentGeneration: DocumentGenerationService,
  ) {}

  /**
   * Active templates for the purpose that match the Tagihan type (or all
   * types), scoped to this warehouse or global; most specific first.
   */
  async listTemplates(
    warehouseId: number,
    tagihanUuid: string,
    purpose: TagihanDocumentPurpose,
  ): Promise<TagihanDocumentTemplateOption[]> {
    const tagihan = await this.findTagihan(warehouseId, tagihanUuid);
    const templates = await this.findMatchingTemplates(
      warehouseId,
      tagihan.type,
      purpose,
    );

    return templates.map((t) => {
      const placeholders = (t.placeholderSchema as any[]) || [];
      return {
        uuid: t.uuid,
        code: t.code,
        name: t.name,
        description: t.description,
        version: t.version,
        tagihanType: t.tagihanType,
        isWarehouseSpecific: t.warehouseId !== null,
        placeholderSchema: placeholders,
        customKeys: checkTagihanTemplateTags(
          purpose,
          placeholders.map((p) => p.key),
        ).customKeys,
      };
    });
  }

  /**
   * Autofill values computed from the Tagihan; locked keys are recomputed on
   * generate, so the client can only change the editable ones.
   */
  async prefill(
    warehouseId: number,
    tagihanUuid: string,
    purpose: TagihanDocumentPurpose,
    timeZone: string,
    templateUuid?: string,
  ): Promise<TagihanDocumentPrefill> {
    const tagihan = await this.findTagihanForDocuments(warehouseId, tagihanUuid);
    if (purpose === 'SURAT_PERMOHONAN') {
      return this.prefillSuratPermohonan(tagihan, timeZone, templateUuid);
    }
    return this.prefillTandaTerima(tagihan, timeZone);
  }

  async generateSuratPermohonan(
    warehouseId: number,
    tagihanUuid: string,
    body: GenerateSuratPermohonanInput,
    userId: number,
    timeZone: string,
  ) {
    const tagihan = await this.findTagihanForDocuments(warehouseId, tagihanUuid);
    const template = await this.findAllowedTemplate(
      warehouseId,
      tagihan.type,
      'SURAT_PERMOHONAN',
      body.templateUuid,
    );

    const prefill = await this.prefillSuratPermohonan(
      tagihan,
      timeZone,
      template.uuid,
    );
    const values = this.mergeValues(
      'SURAT_PERMOHONAN',
      prefill.values,
      body.values,
      prefill.editableKeys,
      this.templateCustomKeys(template, 'SURAT_PERMOHONAN'),
    );
    const nomorSurat = String(values.nomor_surat || '').trim();
    if (!nomorSurat) {
      throw new BadRequestException('Nomor surat wajib diisi.');
    }

    return this.startGeneration({
      tagihan,
      template,
      purpose: 'SURAT_PERMOHONAN',
      userId,
      warehouseId,
      documentNumber: nomorSurat,
      values,
      snapshot: { values, templateVersion: template.version },
    });
  }

  async generateTandaTerima(
    warehouseId: number,
    tagihanUuid: string,
    body: GenerateTandaTerimaInput,
    userId: number,
    timeZone: string,
  ) {
    const tagihan = await this.findTagihanForDocuments(warehouseId, tagihanUuid);

    let templateUuid = body.templateUuid;
    if (!templateUuid) {
      const [first] = await this.findMatchingTemplates(
        warehouseId,
        tagihan.type,
        'TANDA_TERIMA',
      );
      if (!first) {
        throw new BadRequestException(
          'Belum ada template Tanda Terima aktif untuk gudang dan tipe tagihan ini.',
        );
      }
      templateUuid = first.uuid;
    }
    const template = await this.findAllowedTemplate(
      warehouseId,
      tagihan.type,
      'TANDA_TERIMA',
      templateUuid,
    );

    const totalPayment = toRupiahInteger(tagihan.totalAmount);
    if (totalPayment <= 0) {
      throw new BadRequestException(
        'Total tagihan masih Rp 0, tanda terima tidak dapat dibuat.',
      );
    }

    // Recipients must be active, non-deleted buruh of this warehouse
    const buruhs = await this.prisma.buruh.findMany({
      where: {
        warehouseId,
        deletedAt: null,
        isActive: true,
        uuid: { in: body.recipients.map((r) => r.buruhUuid) },
      },
      select: { uuid: true, name: true },
    });
    const nameByUuid = new Map(buruhs.map((b) => [b.uuid, b.name]));
    const unknown = body.recipients.filter((r) => !nameByUuid.has(r.buruhUuid));
    if (unknown.length > 0) {
      throw new BadRequestException(
        'Sebagian buruh yang dipilih tidak ditemukan atau sudah nonaktif. Muat ulang daftar buruh.',
      );
    }

    const difference = allocationDifference(totalPayment, body.recipients);
    if (difference !== 0) {
      throw new BadRequestException(
        `Jumlah pembayaran buruh harus sama dengan total tagihan (selisih Rp ${formatNumberId(difference)}).`,
      );
    }

    const prefill = await this.prefillTandaTerima(tagihan, timeZone);
    const editable = this.mergeValues(
      'TANDA_TERIMA',
      prefill.values,
      body.values,
      prefill.editableKeys,
      this.templateCustomKeys(template, 'TANDA_TERIMA'),
    );

    const mandorName =
      prefill.workers?.find((w) => w.isMandor)?.name ??
      nameByUuid.get(body.remainderBuruhUuid) ??
      '';
    const rows = body.recipients.map((r, i) => ({
      no: i + 1,
      nama: nameByUuid.get(r.buruhUuid),
      penyaluran: formatNumberId(r.amount),
      diterima: formatNumberId(r.amount),
      ganjil: (i + 1) % 2 === 1,
    }));
    const values = {
      ...editable,
      buruh: rows,
      jumlah_buruh: rows.length,
      total_penyaluran: formatNumberId(totalPayment),
      total_diterima: formatNumberId(totalPayment),
      mandor: mandorName,
    };

    return this.startGeneration({
      tagihan,
      template,
      purpose: 'TANDA_TERIMA',
      userId,
      warehouseId,
      documentNumber: tagihan.documentNumber,
      values,
      snapshot: {
        values,
        templateVersion: template.version,
        totalPayment,
        remainderBuruhUuid: body.remainderBuruhUuid,
        recipients: body.recipients.map((r) => ({
          buruhUuid: r.buruhUuid,
          name: nameByUuid.get(r.buruhUuid),
          amount: r.amount,
        })),
      },
    });
  }

  /**
   * Generation history for the Tagihan; stuck jobs are failed on read so the
   * user can retry.
   */
  async listHistory(
    warehouseId: number,
    tagihanUuid: string,
    purpose?: TagihanDocumentPurpose,
  ): Promise<TagihanGeneratedDocumentItem[]> {
    const tagihan = await this.findTagihan(warehouseId, tagihanUuid);
    await this.failStuckGenerations(tagihan.id);

    const docs = await this.prisma.documentGenerated.findMany({
      where: {
        tagihanId: tagihan.id,
        deletedAt: null,
        tagihanPurpose: purpose ?? { not: null },
      },
      orderBy: { generatedAt: 'desc' },
      include: {
        template: { select: { name: true, version: true } },
        generator: { select: { name: true } },
        tagihanFiles: {
          select: { uuid: true, fileName: true, mimeType: true },
          orderBy: { id: 'asc' },
        },
      },
    });

    return docs.map((d) => ({
      uuid: d.uuid,
      purpose: d.tagihanPurpose as TagihanDocumentPurpose,
      title: d.title,
      documentNumber: d.documentNumber,
      status: d.status as TagihanGeneratedDocumentItem['status'],
      progress: d.progress,
      stage: d.stage,
      errorMessage: d.errorMessage,
      generatedAt: d.generatedAt.toISOString(),
      template: d.template,
      generator: d.generator,
      files: d.tagihanFiles,
    }));
  }

  async getFileUrl(
    warehouseId: number,
    tagihanUuid: string,
    docUuid: string,
    kind: 'preview' | 'pdf' | 'docx',
  ) {
    const tagihan = await this.findTagihan(warehouseId, tagihanUuid);
    const doc = await this.prisma.documentGenerated.findFirst({
      where: { uuid: docUuid, tagihanId: tagihan.id, deletedAt: null },
    });
    if (!doc) {
      throw new NotFoundException('Dokumen tidak ditemukan.');
    }

    const key = kind === 'docx' ? doc.docxObjectKey : doc.pdfObjectKey;
    if (!key) {
      throw new BadRequestException('File belum siap atau proses generate gagal.');
    }
    const safeName = `${doc.title}`.replace(/[^\w.-]+/g, '_');
    return this.storageService.getFilePrivateUrl(
      key,
      3600,
      kind === 'preview' ? undefined : `${safeName}.${kind}`,
    );
  }

  // -------------------------------------------------------------------------
  // Generation orchestration
  // -------------------------------------------------------------------------

  /**
   * Lock (tagihan, purpose), reject a concurrent run, create the record and
   * enqueue. The lock is transaction-scoped so two requests cannot both pass.
   */
  private async startGeneration(params: {
    tagihan: TagihanForDocuments;
    template: {
      id: number;
      uuid: string;
      categoryId: number;
      version: number;
      placeholderSchema: Prisma.JsonValue;
    };
    purpose: TagihanDocumentPurpose;
    userId: number;
    warehouseId: number;
    documentNumber: string;
    values: Record<string, any>;
    snapshot: Record<string, any>;
  }) {
    const { tagihan, template, purpose } = params;
    await this.failStuckGenerations(tagihan.id);

    const record = await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(${tagihan.id}::int, hashtext(${`TAGIHAN_DOC_${purpose}`}))`;

      const running = await tx.documentGenerated.findFirst({
        where: {
          tagihanId: tagihan.id,
          tagihanPurpose: purpose,
          status: 'PROCESSING',
          deletedAt: null,
        },
        select: { id: true },
      });
      if (running) {
        throw new ConflictException(
          `${TAGIHAN_PURPOSE_LABELS[purpose]} untuk tagihan ini sedang diproses. Tunggu hingga selesai.`,
        );
      }

      return this.documentGeneration.createGenerationRecord(tx, {
        template,
        title: `${TAGIHAN_PURPOSE_LABELS[purpose]} ${tagihan.type} - ${tagihan.documentNumber}`,
        documentNumber: params.documentNumber,
        userId: params.userId,
        warehouseId: params.warehouseId,
        tagihan: {
          tagihanId: tagihan.id,
          tagihanPurpose: purpose,
          inputSnapshot: params.snapshot as Prisma.InputJsonValue,
        },
      });
    });

    try {
      await this.documentGeneration.enqueueGeneration({
        documentGeneratedId: record.id,
        templateId: template.id,
        // docxtemplater tags are case-sensitive: render under the template's own names
        placeholder: expandToTemplateKeys(
          purpose,
          params.values,
          this.templateKeys(template),
        ),
        userId: params.userId,
        warehouseId: params.warehouseId,
        tagihanAttachment: {
          tagihanId: tagihan.id,
          tagihanUuid: tagihan.uuid,
          fileType: purpose,
          fileBaseName: `${purpose === 'SURAT_PERMOHONAN' ? 'Surat_Permohonan' : 'Tanda_Terima'}_${tagihan.type}_${tagihan.documentNumber}`,
        },
      });
    } catch (err: any) {
      // Never leave a PROCESSING record that blocks retries
      await this.prisma.documentGenerated.update({
        where: { id: record.id },
        data: {
          status: 'FAILED',
          stage: 'FAILED',
          errorMessage: 'Gagal memasukkan antrean generate dokumen.',
        },
      });
      this.logger.error(`Failed to enqueue generation ${record.uuid}: ${err.message}`);
      throw err;
    }

    return { uuid: record.uuid, status: record.status };
  }

  private async failStuckGenerations(tagihanId: number) {
    await this.prisma.documentGenerated.updateMany({
      where: {
        tagihanId,
        status: 'PROCESSING',
        updatedAt: { lt: new Date(Date.now() - STUCK_AFTER_MS) },
      },
      data: {
        status: 'FAILED',
        stage: 'FAILED',
        errorMessage: 'Proses generate terhenti. Silakan coba lagi.',
      },
    });
  }

  /**
   * Prefill + client edits: only editable standard keys and template-specific
   * custom keys can be overridden; derived keys always come from the Tagihan.
   */
  private mergeValues(
    purpose: TagihanDocumentPurpose,
    base: Record<string, any>,
    input: Record<string, any> | undefined,
    editableKeys: string[],
    customKeys: string[],
  ) {
    const merged = { ...base };
    for (const [key, value] of Object.entries(input || {})) {
      // Template tags may arrive as e.g. "TANGGAL"; store them under the standard key
      const canonical = canonicalTagihanKey(purpose, key);
      if (canonical && editableKeys.includes(canonical)) {
        merged[canonical] = value === null || value === undefined ? '' : String(value).trim();
      } else if (customKeys.includes(key)) {
        merged[key] = value;
      }
    }
    return merged;
  }

  private templateKeys(template: { placeholderSchema: Prisma.JsonValue }): string[] {
    return ((template.placeholderSchema as any[]) || []).map((p) => p.key);
  }

  private templateCustomKeys(
    template: { placeholderSchema: Prisma.JsonValue },
    purpose: TagihanDocumentPurpose,
  ) {
    // Only top-level custom keys are user-entered values
    return checkTagihanTemplateTags(purpose, this.templateKeys(template)).customKeys.filter(
      (k) => !k.includes('.'),
    );
  }

  // -------------------------------------------------------------------------
  // Prefill builders
  // -------------------------------------------------------------------------

  private async prefillSuratPermohonan(
    tagihan: TagihanForDocuments,
    timeZone: string,
    templateUuid?: string,
  ): Promise<TagihanDocumentPrefill> {
    const metrics = this.computeMetrics(tagihan, timeZone);

    const lastSurat = await this.prisma.documentGenerated.findFirst({
      where: {
        warehouseId: tagihan.warehouseId,
        tagihanPurpose: 'SURAT_PERMOHONAN',
        deletedAt: null,
        ...(templateUuid ? { template: { uuid: templateUuid } } : {}),
      },
      orderBy: { generatedAt: 'desc' },
      select: { documentNumber: true },
    });

    // Rebagging/Reproses ERP documents carry their MO number in refFax
    const moNumbers = new Set<string>();
    for (const link of tagihan.documentReferences) {
      const ref = link.documentReference.refFax?.trim();
      if (ref && /^MO\//i.test(ref)) moNumbers.add(ref);
    }

    const productsByUom = new Map<string, Set<string>>();
    for (const link of tagihan.documentReferences) {
      for (const item of link.documentReference.items) {
        const set = productsByUom.get(item.uom) ?? new Set<string>();
        set.add(productLabel(item.productName));
        productsByUom.set(item.uom, set);
      }
    }

    return {
      purpose: 'SURAT_PERMOHONAN',
      editableKeys: TAGIHAN_EDITABLE_KEYS.SURAT_PERMOHONAN,
      values: {
        nomor_surat: suggestNextNomorSurat(lastSurat?.documentNumber),
        nomor_sdi: tagihan.documentNumber,
        nomor_mo: Array.from(moNumbers).join(', '),
        tanggal_surat: formatTanggalId(new Date(), timeZone),
        periode: metrics.periode,
        komoditas: metrics.komoditas,
        kuantum: formatNumberId(metrics.kuantumKg, 2),
        satuan: 'Kg',
        biaya: formatNumberId(metrics.ratePerKg, 2),
        jumlah: formatNumberId(metrics.subtotal),
        total: formatNumberId(metrics.total),
        terbilang: terbilangRupiah(metrics.total),
        rincian: tagihan.summaries.map((s) => ({
          // Summary UOMs don't always match ERP item UOMs; fall back to all products
          komoditas:
            Array.from(productsByUom.get(s.uom) ?? []).join(', ') || metrics.komoditas,
          kuantum: formatNumberId(s.quantity, 2),
          satuan: s.uom,
          biaya: formatNumberId(s.costPerUnit, 2),
          jumlah: formatNumberId(toRupiahInteger(s.subtotal)),
        })),
      },
    };
  }

  private async prefillTandaTerima(
    tagihan: TagihanForDocuments,
    timeZone: string,
  ): Promise<TagihanDocumentPrefill> {
    const metrics = this.computeMetrics(tagihan, timeZone);

    const [workers, lastTandaTerima] = await Promise.all([
      this.prisma.buruh.findMany({
        where: { warehouseId: tagihan.warehouseId, deletedAt: null, isActive: true },
        orderBy: [{ isMandor: 'desc' }, { name: 'asc' }],
        select: { uuid: true, name: true, isMandor: true },
      }),
      this.prisma.documentGenerated.findFirst({
        where: {
          warehouseId: tagihan.warehouseId,
          tagihanPurpose: 'TANDA_TERIMA',
          status: 'GENERATED',
          deletedAt: null,
        },
        orderBy: { generatedAt: 'desc' },
        select: { inputSnapshot: true },
      }),
    ]);

    const remembered = ((lastTandaTerima?.inputSnapshot as any)?.values ?? {}) as Record<string, any>;
    const fromLast = (key: string, fallback: string) =>
      TT_REMEMBERED_KEYS.includes(key) && typeof remembered[key] === 'string' && remembered[key]
        ? remembered[key]
        : fallback;

    const mandor = workers.find((w) => w.isMandor) ?? null;

    return {
      purpose: 'TANDA_TERIMA',
      editableKeys: TAGIHAN_EDITABLE_KEYS.TANDA_TERIMA,
      totalPayment: metrics.total,
      workers,
      defaultRemainderBuruhUuid: mandor?.uuid ?? workers[0]?.uuid ?? null,
      values: {
        judul: `TANDA TERIMA BIAYA ${tagihan.type}`,
        nama_gudang: fromLast('nama_gudang', tagihan.warehouse.name.toUpperCase()),
        kanwil: fromLast('kanwil', ''),
        tanggal: formatTanggalId(new Date(), timeZone),
        tonase: formatNumberId(metrics.kuantumKg, 2),
        upah_per_kg: formatNumberId(metrics.ratePerKg, 2),
        total_upah: formatNumberId(metrics.total),
        kota: fromLast('kota', ''),
        tanggal_ttd: formatBulanTahunId(new Date(), timeZone),
        kepala_gudang: fromLast('kepala_gudang', ''),
        mandor: mandor?.name ?? '',
      },
    };
  }

  private computeMetrics(tagihan: TagihanForDocuments, timeZone: string) {
    const kuantumKg = tagihan.summaries.reduce(
      (sum, s) => sum + getSecondaryQty(s.quantity, s.uom),
      0,
    );
    const subtotal = toRupiahInteger(
      tagihan.summaries.reduce((sum, s) => sum + s.subtotal, 0),
    );
    const total = toRupiahInteger(tagihan.totalAmount);

    const dates = tagihan.documentReferences
      .map((l) => l.documentReference.dateDone ?? l.documentReference.scheduledDate)
      .filter((d): d is Date => !!d)
      .sort((a, b) => a.getTime() - b.getTime());
    const periode = dates.length
      ? formatPeriodeId(dates[0], dates[dates.length - 1], timeZone)
      : formatBulanTahunId(tagihan.tagihanDate, timeZone);

    const products = new Set<string>();
    for (const link of tagihan.documentReferences) {
      for (const item of link.documentReference.items) products.add(productLabel(item.productName));
    }

    return {
      kuantumKg,
      subtotal,
      total,
      ratePerKg: kuantumKg > 0 ? total / kuantumKg : 0,
      periode,
      komoditas: Array.from(products).join(', '),
    };
  }

  // -------------------------------------------------------------------------
  // Lookups (always warehouse-scoped)
  // -------------------------------------------------------------------------

  private async findTagihan(warehouseId: number, uuid: string) {
    const tagihan = await this.prisma.tagihan.findFirst({
      where: { uuid, warehouseId },
      select: { id: true, uuid: true, type: true },
    });
    if (!tagihan) {
      throw new NotFoundException('Data Tagihan tidak ditemukan.');
    }
    return tagihan;
  }

  private async findTagihanForDocuments(
    warehouseId: number,
    uuid: string,
  ): Promise<TagihanForDocuments> {
    const tagihan = await this.prisma.tagihan.findFirst({
      where: { uuid, warehouseId },
      include: {
        summaries: true,
        warehouse: { select: { name: true } },
        documentReferences: {
          include: {
            documentReference: {
              select: {
                dateDone: true,
                scheduledDate: true,
                refFax: true,
                items: { select: { productName: true, uom: true } },
              },
            },
          },
        },
      },
    });
    if (!tagihan) {
      throw new NotFoundException('Data Tagihan tidak ditemukan.');
    }
    return tagihan;
  }

  private findMatchingTemplates(
    warehouseId: number,
    tagihanType: TagihanForDocuments['type'],
    purpose: TagihanDocumentPurpose,
  ) {
    return this.prisma.documentTemplate.findMany({
      where: {
        deletedAt: null,
        isActive: true,
        tagihanPurpose: purpose,
        AND: [
          { OR: [{ tagihanType }, { tagihanType: null }] },
          { OR: [{ warehouseId }, { warehouseId: null }] },
        ],
      },
      // Warehouse-specific and type-specific templates first (NULLS LAST)
      orderBy: [
        { warehouseId: { sort: 'asc', nulls: 'last' } },
        { tagihanType: { sort: 'asc', nulls: 'last' } },
        { name: 'asc' },
      ],
    });
  }

  private async findAllowedTemplate(
    warehouseId: number,
    tagihanType: TagihanForDocuments['type'],
    purpose: TagihanDocumentPurpose,
    templateUuid: string,
  ) {
    const templates = await this.findMatchingTemplates(warehouseId, tagihanType, purpose);
    const template = templates.find((t) => t.uuid === templateUuid);
    if (!template) {
      throw new BadRequestException(
        'Template tidak tersedia untuk tipe tagihan ini atau sudah tidak aktif.',
      );
    }
    return template;
  }
}
