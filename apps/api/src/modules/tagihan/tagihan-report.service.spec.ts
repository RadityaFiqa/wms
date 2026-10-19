import * as fs from 'fs';
import * as os from 'os';
import axios from 'axios';
import { PDFDocument, degrees } from 'pdf-lib';
import {
  TagihanReportService,
  OdooReportProgress,
} from './tagihan-report.service';

jest.mock('axios');
const mockedPost = axios.post as jest.Mock;

const A4: [number, number] = [595.28, 841.89];
const A4_LANDSCAPE: [number, number] = [841.89, 595.28];

async function buildPdf(
  pages: { size?: [number, number]; rotate?: number }[],
): Promise<Buffer> {
  const doc = await PDFDocument.create();
  pages.forEach((p, i) => {
    const page = doc.addPage(p.size || A4);
    page.drawText(`Page ${i + 1}`, { x: 50, y: 50, size: 24 });
    if (p.rotate) page.setRotation(degrees(p.rotate));
  });
  return Buffer.from(await doc.save());
}

const pdfResponse = (data: Buffer) => ({
  status: 200,
  headers: { 'content-type': 'application/pdf' },
  data,
});

const tempDirs = () =>
  fs.readdirSync(os.tmpdir()).filter((d) => d.startsWith('bulog-odoo-report-'));

describe('TagihanReportService - downloadOdooReportPdf', () => {
  let service: TagihanReportService;

  const tagihan = {
    type: 'LOADING',
    warehouseId: 1,
    documentReferences: [
      {
        documentReferenceId: 30,
        documentReference: { id: 30, documentNumber: 'OUT/030' },
      },
      {
        documentReferenceId: 10,
        documentReference: { id: 10, documentNumber: 'OUT/010' },
      },
      {
        documentReferenceId: 20,
        documentReference: { id: 20, documentNumber: 'OUT/020' },
      },
      {
        documentReferenceId: 40,
        documentReference: { id: 40, documentNumber: 'OUT/040' },
      },
    ],
  };

  beforeEach(() => {
    mockedPost.mockReset();
    const account = {
      id: 1,
      baseUrl: 'http://odoo.test',
      sessionId: 'sess',
      csrfToken: 'tok',
    };
    const prismaMock: any = {
      odooAccount: {
        findFirst: jest.fn().mockResolvedValue(account),
        findUnique: jest.fn().mockResolvedValue(account),
        update: jest.fn().mockResolvedValue(account),
      },
    };
    const odooClientMock: any = {
      getSessionInfo: jest.fn().mockResolvedValue({ uid: 2, user_context: {} }),
      getWebCsrfToken: jest.fn().mockResolvedValue('csrf'),
    };
    const sessionManagerMock: any = {
      validateAndRefreshSession: jest.fn().mockResolvedValue(true),
      invalidateSession: jest.fn().mockResolvedValue(undefined),
    };
    service = new TagihanReportService(
      prismaMock,
      {} as any,
      odooClientMock,
      sessionManagerMock,
      {} as any,
      {} as any,
    );
  });

  it('downloads sequentially in document order, applies 2-up to PDFs with 2+ pages and merges', async () => {
    const pdfs: Record<number, Buffer> = {
      30: await buildPdf([{}]), // 1 page -> unchanged
      10: await buildPdf([{}, {}, {}]), // 3 portrait pages -> 2 landscape sheets
      20: await buildPdf([
        { size: A4_LANDSCAPE },
        { size: A4_LANDSCAPE },
        { size: A4_LANDSCAPE, rotate: 90 },
        { size: A4_LANDSCAPE },
      ]), // 4 landscape pages -> 2 portrait sheets
      40: await buildPdf([{}, {}]), // 2 portrait pages -> 1 landscape sheet
    };

    let inFlight = 0;
    let maxInFlight = 0;
    mockedPost.mockImplementation(async (_url: string, form: FormData) => {
      inFlight++;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((r) => setTimeout(r, 5));
      inFlight--;
      const [reportPath] = JSON.parse(String(form.get('data')));
      const id = Number(reportPath.split('/').pop());
      return pdfResponse(pdfs[id]);
    });

    const progress: OdooReportProgress[] = [];
    const before = tempDirs().length;
    const result = await service.downloadOdooReportPdf(tagihan, async (p) => {
      progress.push(p);
    });

    // Sequential, ordered requests
    expect(maxInFlight).toBe(1);
    const requestedIds = mockedPost.mock.calls.map(([, form]) =>
      JSON.parse(String(form.get('data')))[0]
        .split('/')
        .pop(),
    );
    expect(requestedIds).toEqual(['30', '10', '20', '40']);

    // Merged output: 1 + 2 + 2 + 1 pages
    const merged = await PDFDocument.load(result);
    const sizes = merged.getPages().map((p) => {
      const { width, height } = p.getSize();
      return [Math.round(width), Math.round(height)];
    });
    expect(sizes).toEqual([
      [595, 842], // original single page
      [842, 595], // 2-up sheet (pages 1-2)
      [842, 595], // 2-up sheet (odd trailing page 3)
      [595, 842], // landscape pages stacked on portrait sheet
      [595, 842],
      [842, 595], // 2-page PDF -> single 2-up sheet
    ]);

    // Progress is monotonic and covers every stage
    const stages = Array.from(new Set(progress.map((p) => p.stage)));
    expect(stages).toEqual([
      'PREPARING',
      'DOWNLOADING',
      'OPTIMIZING',
      'MERGING',
    ]);
    progress.reduce((prev, p) => {
      expect(p.progress).toBeGreaterThanOrEqual(prev);
      return p.progress;
    }, 0);
    expect(progress[progress.length - 1]).toMatchObject({
      processedCount: 4,
      totalCount: 4,
    });

    // Temp directory cleaned up
    expect(tempDirs().length).toBe(before);
  });

  it('retries a failed download and succeeds', async () => {
    const pdf = await buildPdf([{}]);
    mockedPost
      .mockRejectedValueOnce(
        Object.assign(new Error('timeout'), { code: 'ECONNABORTED' }),
      )
      .mockResolvedValue(pdfResponse(pdf));

    const result = await service.downloadOdooReportPdf({
      ...tagihan,
      documentReferences: [tagihan.documentReferences[0]],
    });

    expect(mockedPost).toHaveBeenCalledTimes(2);
    expect((await PDFDocument.load(result)).getPageCount()).toBe(1);
  }, 20000);

  it('fails the whole process after 3 invalid responses and cleans up', async () => {
    const pdf = await buildPdf([{}]);
    mockedPost.mockImplementation(async (_url: string, form: FormData) => {
      const id = JSON.parse(String(form.get('data')))[0]
        .split('/')
        .pop();
      if (id === '10') {
        return {
          status: 200,
          headers: { 'content-type': 'text/html' },
          data: Buffer.from('<html>Traceback error</html>'),
        };
      }
      return pdfResponse(pdf);
    });

    const before = tempDirs().length;
    await expect(service.downloadOdooReportPdf(tagihan)).rejects.toThrow(
      /OUT\/010 setelah 3 percobaan/,
    );
    // Doc 30 once, doc 10 three times, docs 20 and 40 never attempted
    expect(mockedPost).toHaveBeenCalledTimes(4);
    expect(tempDirs().length).toBe(before);
  }, 20000);

  it('versions only the Odoo report fingerprint by page layout', () => {
    const base = 'abc';
    expect(service.getReportFingerprint(base, 'COMMODITY_RECAP_PDF')).toBe(base);
    expect(service.getReportFingerprint(base, 'COMMODITY_RECAP_EXCEL')).toBe(base);
    const odoo = service.getReportFingerprint(base, 'ODOO_REPORT_PDF');
    expect(odoo).not.toBe(base);
    expect(service.getReportFingerprint(base, 'ODOO_REPORT_PDF')).toBe(odoo);
  });
});
