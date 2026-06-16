/**
 * ADR-457 Slice 5 — detail-pdf-renderer unit tests (jsPDF + greek-font mocked).
 *
 * Verifies the PDF backend registers the Greek font up-front, draws the page
 * frame + each region (frame/heading) and routes every primitive kind to the
 * matching jsPDF call (line / polyline / circle / text / dim / raster).
 */

import { buildDetailSheetPdf } from '../render/detail-pdf-renderer';
import { registerGreekFont } from '@/services/pdf/greek-font-loader';
import type { DetailSheetModel } from '../detail-sheet-types';

jest.mock('@/services/pdf/greek-font-loader', () => ({
  registerGreekFont: jest.fn().mockResolvedValue(undefined),
}));

interface PdfStub {
  setDrawColor: jest.Mock; setFillColor: jest.Mock; setTextColor: jest.Mock;
  setLineWidth: jest.Mock; setLineDashPattern: jest.Mock; setFont: jest.Mock; setFontSize: jest.Mock;
  rect: jest.Mock; line: jest.Mock; lines: jest.Mock; circle: jest.Mock; triangle: jest.Mock;
  text: jest.Mock; addImage: jest.Mock; output: jest.Mock;
}

const ctorArgs: unknown[] = [];
let lastPdf: PdfStub;

jest.mock('jspdf', () => {
  return jest.fn().mockImplementation((opts: unknown) => {
    ctorArgs.push(opts);
    lastPdf = {
      setDrawColor: jest.fn(), setFillColor: jest.fn(), setTextColor: jest.fn(),
      setLineWidth: jest.fn(), setLineDashPattern: jest.fn(), setFont: jest.fn(), setFontSize: jest.fn(),
      rect: jest.fn(), line: jest.fn(), lines: jest.fn(), circle: jest.fn(), triangle: jest.fn(),
      text: jest.fn(), addImage: jest.fn(), output: jest.fn().mockReturnValue(new Blob()),
    };
    return lastPdf;
  });
});

const STROKE = { colorHex: '#333333', widthMm: 0.2 };

const MODEL: DetailSheetModel = {
  paper: { size: 'A3', orientation: 'landscape' },
  sheetWidthMm: 420,
  sheetHeightMm: 297,
  regions: [
    {
      id: 'plan', rectMm: { x: 10, y: 10, w: 100, h: 120 }, title: 'ΚΑΤΟΨΗ', caption: '1:10',
      primitives: [
        { kind: 'line', a: { x: 12, y: 12 }, b: { x: 40, y: 12 }, stroke: STROKE },
        { kind: 'polyline', points: [{ x: 12, y: 12 }, { x: 40, y: 12 }, { x: 40, y: 40 }], closed: true, stroke: STROKE },
        { kind: 'circle', center: { x: 20, y: 20 }, radiusMm: 1.5, fillHex: '#c0392b' },
        { kind: 'text', position: { x: 20, y: 50 }, text: 'Ø16', heightMm: 2.6, colorHex: '#222222', align: 'left' },
        { kind: 'dim', p1: { x: 12, y: 60 }, p2: { x: 40, y: 60 }, offsetMm: 5, text: '400', stroke: STROKE },
      ],
    },
    {
      id: 'perspective', rectMm: { x: 120, y: 10, w: 160, h: 277 }, title: '3Δ',
      primitives: [
        { kind: 'raster', rect: { x: 122, y: 20, w: 150, h: 250 }, dataUrl: 'data:image/png;base64,AAAA', widthPx: 600, heightPx: 1000 },
      ],
    },
  ],
};

describe('buildDetailSheetPdf (ADR-457 Slice 5)', () => {
  beforeEach(() => {
    ctorArgs.length = 0;
    (registerGreekFont as jest.Mock).mockClear();
  });

  it('creates an A3-landscape mm document and registers the Greek font', async () => {
    await buildDetailSheetPdf(MODEL);
    expect(ctorArgs[0]).toEqual({ orientation: 'landscape', unit: 'mm', format: 'a3' });
    expect(registerGreekFont).toHaveBeenCalledTimes(1);
  });

  it('draws the page frame plus one frame rect per region', async () => {
    await buildDetailSheetPdf(MODEL);
    // page border + 2 region frames = 3 stroked rects.
    expect(lastPdf.rect).toHaveBeenCalledTimes(3);
  });

  it('routes every primitive kind to its jsPDF call', async () => {
    await buildDetailSheetPdf(MODEL);
    expect(lastPdf.line).toHaveBeenCalled();      // line + dim extension/dimension lines
    expect(lastPdf.lines).toHaveBeenCalled();     // polyline
    expect(lastPdf.circle).toHaveBeenCalled();    // circle
    expect(lastPdf.triangle).toHaveBeenCalled();  // dim arrowheads
    expect(lastPdf.addImage).toHaveBeenCalled();  // raster
    // headings + caption + cell text + dim text.
    expect(lastPdf.text).toHaveBeenCalled();
  });

  it('skips a raster slot that is still pending (null dataUrl)', async () => {
    const pending: DetailSheetModel = {
      ...MODEL,
      regions: [{ id: 'perspective', rectMm: { x: 0, y: 0, w: 10, h: 10 }, title: '3Δ', primitives: [
        { kind: 'raster', rect: { x: 0, y: 0, w: 10, h: 10 }, dataUrl: null },
      ] }],
    };
    await buildDetailSheetPdf(pending);
    expect(lastPdf.addImage).not.toHaveBeenCalled();
  });

  it('returns a Blob via output("blob")', async () => {
    const pdf = await buildDetailSheetPdf(MODEL);
    expect(pdf.output('blob')).toBeInstanceOf(Blob);
  });
});
