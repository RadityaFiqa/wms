import * as ExcelJS from 'exceljs';
import type {
  InboundGroupSummary,
  StockInboundResponse,
} from '@bulog-wms/schema';
import { ReportsAnalyticsExportService } from '@/modules/reports/reports-analytics-export.service';

const KG = { key: 'Kg', label: 'Berat', baseUnit: 'Kg', displayUnit: 'Kg' };

const groupSummary = (displayQty: number): InboundGroupSummary => ({
  displayQty,
  sharePct: 0,
  senderCount: 1,
  stackCount: 1,
  lotCount: 1,
  lastReceivedAt: null,
  pendingDisplayQty: 0,
  pendingGateCount: 0,
});

const stock: StockInboundResponse = {
  totals: [
    {
      ...KG,
      displayUnit: 'Ton',
      displayQty: 8,
      pendingDisplayQty: 0.5,
    },
  ],
  stackCount: 2,
  productCount: 1,
  products: [
    {
      productUuid: 'p-1',
      sku: 'B001',
      name: '[B001] Beras Medium 50 KG',
      category: 'BERAS',
      uom: 'Kg',
      unit: KG,
      qty: 8000,
      displayQty: 8000,
      pendingQty: 500,
      pendingDisplayQty: 500,
      stackCount: 2,
      senderCount: 2,
      groups: [
        {
          folder: { uuid: 'f-1', name: 'Pengolahan Kalsel' },
          summary: groupSummary(5000),
          senders: [
            {
              name: 'Manager Pengolahan Kalsel',
              originCategory: 'Pengolahan',
              displayQty: 5000,
              pendingDisplayQty: 0,
              pendingGateCount: 0,
              stacks: [
                {
                  locationUuid: 'loc-1',
                  locationName: 'GD1/T01',
                  displayQty: 5000,
                  lots: [
                    {
                      lotName: 'LOT-A',
                      qty: 3000,
                      displayQty: 3000,
                      documents: [
                        {
                          documentUuid: 'd-1',
                          documentNumber: 'WH/IN/0001',
                          dateDone: '2026-10-01T02:00:00.000Z',
                        },
                      ],
                      pendingGate: null,
                    },
                    {
                      lotName: 'LOT-B',
                      qty: 2000,
                      displayQty: 2000,
                      documents: [],
                      pendingGate: null,
                    },
                  ],
                },
              ],
            },
          ],
        },
        {
          folder: null,
          summary: groupSummary(3000),
          senders: [
            {
              name: 'Tidak tercatat',
              originCategory: 'Tidak tercatat',
              displayQty: 3000,
              pendingDisplayQty: 500,
              pendingGateCount: 1,
              stacks: [
                {
                  locationUuid: 'loc-2',
                  locationName: 'GD1/T02',
                  displayQty: 3000,
                  lots: [
                    {
                      lotName: null,
                      qty: 2500,
                      displayQty: 2500,
                      documents: [],
                      pendingGate: null,
                    },
                    {
                      lotName: 'LOT-C',
                      qty: 500,
                      displayQty: 500,
                      documents: [],
                      pendingGate: {
                        gateOperationUuid: 'g-1',
                        opNumber: 'GATE-IN-0042',
                        cardType: 'IN',
                        date: '2026-11-16T01:00:00.000Z',
                      },
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    },
  ],
};

/** Values of the data rows under the header row that starts with "No" */
function tableRows(sheet: ExcelJS.Worksheet) {
  let headerRow = 0;
  sheet.eachRow((row, i) => {
    if (!headerRow && row.getCell(1).value === 'No') headerRow = i;
  });
  const rows: ExcelJS.CellValue[][] = [];
  for (let i = headerRow + 1; i <= sheet.rowCount; i++) {
    const values = sheet.getRow(i).values as ExcelJS.CellValue[];
    if (values.length) rows.push(values.slice(1));
  }
  return rows;
}

async function loadWorkbook(buffer: Buffer) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as any);
  return workbook;
}

describe('ReportsAnalyticsExportService - stock inbound', () => {
  let service: ReportsAnalyticsExportService;

  beforeEach(() => {
    const prisma = {
      warehouse: {
        findUnique: jest.fn().mockResolvedValue({ name: 'Gudang Banjarmasin' }),
      },
    };
    const warehouseContext = { getTimezone: () => 'Asia/Makassar' };
    const analytics = {
      getStockInbound: jest
        .fn()
        .mockResolvedValue(JSON.parse(JSON.stringify(stock))),
    };
    service = new ReportsAnalyticsExportService(
      prisma as any,
      warehouseContext as any,
      analytics as any,
    );
  });

  it('writes the summary per folder and sender, in Kg', async () => {
    const file = await service.generateStockInboundXlsx(1);
    expect(file.filename).toMatch(/^stok-inbound-\d{4}-\d{2}-\d{2}\.xlsx$/);

    const workbook = await loadWorkbook(file.buffer);
    expect(workbook.worksheets.map((s) => s.name)).toEqual([
      'Ringkasan',
      'Detail Lot',
    ]);

    const sheet = workbook.getWorksheet('Ringkasan')!;
    // Header total in Kg from the products, not the response totals in Ton
    expect(sheet.getCell('A4').value).toBe(
      'Total stok: 8.000 Kg (termasuk 500 Kg belum diadministrasi)  |  1 produk  |  2 tumpukan',
    );

    const summary = tableRows(sheet);
    expect(summary).toHaveLength(2);
    expect(summary[0].slice(1)).toEqual([
      'BERAS',
      'B001',
      'BERAS MEDIUM 50 KG',
      'Pengolahan Kalsel',
      'Manager Pengolahan Kalsel',
      'Pengolahan',
      1,
      2,
      0,
      5000,
      'Kg',
    ]);
    expect(summary[1][4]).toBe('Tanpa folder');
    expect(summary[1][9]).toBe(500);
  });

  it('writes one detail row per lot with its document or pending gate', async () => {
    const workbook = await loadWorkbook(
      (await service.generateStockInboundXlsx(1)).buffer,
    );
    const detail = tableRows(workbook.getWorksheet('Detail Lot')!);
    expect(detail).toHaveLength(4);
    expect(detail[0].slice(7)).toEqual([
      'GD1/T01',
      'LOT-A',
      'Stok ERP',
      'WH/IN/0001',
      '1 Okt 2026',
      3000,
      'Kg',
    ]);
    expect(detail[2][8]).toBe('Tanpa lot');
    expect(detail[3].slice(8, 12)).toEqual([
      'LOT-C',
      'Belum diadministrasi (Gate IN)',
      'GATE-IN-0042',
      '16 Nov 2026',
    ]);
  });

  it('applies the search and recomputes subtotals from the remaining lots', async () => {
    const file = await service.generateStockInboundXlsx(1, 'lot-b');
    const workbook = await loadWorkbook(file.buffer);
    const sheet = workbook.getWorksheet('Ringkasan')!;

    expect(sheet.getCell('A4').value).toBe('Filter pencarian: "lot-b"');
    expect(sheet.getCell('A5').value).toBe(
      'Total stok: 2.000 Kg  |  1 produk  |  1 tumpukan',
    );

    const summary = tableRows(sheet);
    expect(summary).toHaveLength(1);
    // Sender subtotal is the matching lot only, not the sender's full 5.000 Kg
    expect(summary[0][10]).toBe(2000);

    const detail = tableRows(workbook.getWorksheet('Detail Lot')!);
    expect(detail.map((r) => r[8])).toEqual(['LOT-B']);
  });

  it('finds lots by folder name and pending gate number', async () => {
    const byFolder = await loadWorkbook(
      (await service.generateStockInboundXlsx(1, 'pengolahan kalsel')).buffer,
    );
    expect(
      tableRows(byFolder.getWorksheet('Detail Lot')!).map((r) => r[8]),
    ).toEqual(['LOT-A', 'LOT-B']);

    const byGate = await loadWorkbook(
      (await service.generateStockInboundXlsx(1, 'gate-in-0042')).buffer,
    );
    expect(
      tableRows(byGate.getWorksheet('Detail Lot')!).map((r) => r[8]),
    ).toEqual(['LOT-C']);
  });

  it('renders a PDF', async () => {
    const file = await service.generateStockInboundPdf(1);
    expect(file.filename).toMatch(/\.pdf$/);
    expect(file.buffer.subarray(0, 5).toString()).toBe('%PDF-');
    expect(file.buffer.length).toBeGreaterThan(1000);
  });

  it('renders a PDF when nothing matches the search', async () => {
    const file = await service.generateStockInboundPdf(1, 'tidak-ada');
    expect(file.buffer.subarray(0, 5).toString()).toBe('%PDF-');
  });
});
