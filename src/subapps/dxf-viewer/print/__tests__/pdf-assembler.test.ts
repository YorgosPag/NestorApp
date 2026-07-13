/**
 * ADR-453 (+ ADR-651 Φάση ΣΤ) — pdf-assembler unit tests (jsPDF + greek-font mocked).
 *
 * Η πινακίδα/κορνίζα δεν έχει δικό της ζωγράφο εδώ: ο assembler δέχεται **έτοιμα**
 * `DetailPrimitive[]` σε page-mm και τα περνά στον κοινό `renderDetailPrimitives` (ADR-622).
 */

import jsPDF from 'jspdf';
import { registerGreekFont } from '@/services/pdf/greek-font-loader';
import { renderDetailPrimitives } from '../../bim/structural/detail-sheet/render/detail-pdf-primitives';
import { drawScaleCaption } from '../assemble/scale-caption-renderer';
import { assemblePrintPdf } from '../assemble/pdf-assembler';
import type { DetailPrimitive } from '../../bim/structural/detail-sheet/detail-sheet-types';
import type { CaptureResult } from '../capture/capture-types';
import type { PrintableAreaMm } from '../config/paper-types';

jest.mock('@/services/pdf/greek-font-loader', () => ({
  registerGreekFont: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../bim/structural/detail-sheet/render/detail-pdf-primitives', () => ({
  renderDetailPrimitives: jest.fn(),
}));

jest.mock('../assemble/scale-caption-renderer', () => ({
  drawScaleCaption: jest.fn(),
}));

jest.mock('jspdf', () => {
  const ctor = jest.fn(() => ({
    addImage: jest.fn(),
    output: jest.fn(() => new Blob(['pdf-bytes'], { type: 'application/pdf' })),
  }));
  return { __esModule: true, default: ctor };
});

const CAPTURE: CaptureResult = {
  kind: 'raster',
  dataUrl: 'data:image/png;base64,AAAA',
  widthPx: 1000,
  heightPx: 700,
  appliedScaleDenominator: null,
};

const AREA: PrintableAreaMm = { xMm: 20, yMm: 10, widthMm: 200, heightMm: 180 };

const SHEET: readonly DetailPrimitive[] = [
  {
    kind: 'line',
    a: { x: 0, y: 0 },
    b: { x: 10, y: 0 },
    stroke: { colorHex: '#111111', widthMm: 0.7 },
  },
];

describe('assemblePrintPdf', () => {
  beforeEach(() => jest.clearAllMocks());

  it('creates a jsPDF sized to the requested ISO sheet + orientation', async () => {
    await assemblePrintPdf({
      capture: CAPTURE,
      paper: { size: 'A3', orientation: 'landscape' },
      area: AREA,
    });
    expect(jsPDF).toHaveBeenCalledWith(
      expect.objectContaining({ orientation: 'landscape', unit: 'mm', format: 'a3' }),
    );
  });

  it('registers the Greek font BEFORE drawing anything', async () => {
    await assemblePrintPdf({
      capture: CAPTURE,
      paper: { size: 'A4', orientation: 'portrait' },
      area: AREA,
    });
    const ctor = jsPDF as unknown as jest.Mock;
    const instance = ctor.mock.results[0].value;
    const fontOrder = (registerGreekFont as jest.Mock).mock.invocationCallOrder[0];
    const imageOrder = instance.addImage.mock.invocationCallOrder[0];
    expect(fontOrder).toBeLessThan(imageOrder);
  });

  it('adds the captured PNG and returns the output blob', async () => {
    const blob = await assemblePrintPdf({
      capture: CAPTURE,
      paper: { size: 'A4', orientation: 'portrait' },
      area: AREA,
    });
    const ctor = jsPDF as unknown as jest.Mock;
    const instance = ctor.mock.results[0].value;
    expect(instance.addImage).toHaveBeenCalledWith(
      CAPTURE.dataUrl,
      'PNG',
      expect.any(Number),
      expect.any(Number),
      expect.any(Number),
      expect.any(Number),
      undefined,
      'FAST',
    );
    expect(blob).toBeInstanceOf(Blob);
  });

  // ADR-608 — vector capture invokes its draw closure with the printable area
  // instead of rasterising a PNG. ADR-651: the area is the one the caller resolved
  // (ωφέλιμη περιοχή όταν υπάρχει πινακίδα) — the assembler never recomputes it.
  it('draws a vector capture into the GIVEN area and skips addImage', async () => {
    const draw = jest.fn();
    const vectorCapture: CaptureResult = {
      kind: 'vector',
      appliedScaleDenominator: 50,
      draw,
    };
    await assemblePrintPdf({
      capture: vectorCapture,
      paper: { size: 'A3', orientation: 'landscape' },
      area: AREA,
    });
    const ctor = jsPDF as unknown as jest.Mock;
    const instance = ctor.mock.results[0].value;
    expect(draw).toHaveBeenCalledTimes(1);
    expect(draw).toHaveBeenCalledWith(instance, AREA);
    expect(instance.addImage).not.toHaveBeenCalled();
  });
});

// ADR-651 Φάση ΣΤ — μία μηχανή πινακίδας: ο assembler ΜΟΝΟ προωθεί τα primitives.
describe('assemblePrintPdf — sheet frame + title block (ADR-651)', () => {
  beforeEach(() => jest.clearAllMocks());

  it('renders the sheet primitives AFTER the drawing (πινακίδα πάνω από το σχέδιο)', async () => {
    await assemblePrintPdf({
      capture: CAPTURE,
      paper: { size: 'A3', orientation: 'landscape' },
      area: AREA,
      sheetPrimitives: SHEET,
    });
    const ctor = jsPDF as unknown as jest.Mock;
    const instance = ctor.mock.results[0].value;
    expect(renderDetailPrimitives).toHaveBeenCalledWith(instance, SHEET);
    const imageOrder = instance.addImage.mock.invocationCallOrder[0];
    const sheetOrder = (renderDetailPrimitives as jest.Mock).mock.invocationCallOrder[0];
    expect(imageOrder).toBeLessThan(sheetOrder);
  });

  it('draws the scale caption ONLY when there is no title block', async () => {
    await assemblePrintPdf({
      capture: CAPTURE,
      paper: { size: 'A3', orientation: 'landscape' },
      area: AREA,
      sheetPrimitives: SHEET,
      scaleText: '1:50',
    });
    expect(drawScaleCaption).not.toHaveBeenCalled();

    await assemblePrintPdf({
      capture: CAPTURE,
      paper: { size: 'A3', orientation: 'landscape' },
      area: AREA,
      scaleText: '1:50',
    });
    expect(drawScaleCaption).toHaveBeenCalledTimes(1);
    expect(renderDetailPrimitives).toHaveBeenCalledTimes(1);
  });
});
