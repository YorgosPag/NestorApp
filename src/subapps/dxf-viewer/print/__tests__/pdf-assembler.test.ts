/**
 * ADR-453 — pdf-assembler unit tests (jsPDF + greek-font mocked).
 */

import jsPDF from 'jspdf';
import { registerGreekFont } from '@/services/pdf/greek-font-loader';
import { assemblePrintPdf } from '../assemble/pdf-assembler';
import type { CaptureResult } from '../capture/capture-types';

jest.mock('@/services/pdf/greek-font-loader', () => ({
  registerGreekFont: jest.fn().mockResolvedValue(undefined),
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

describe('assemblePrintPdf', () => {
  beforeEach(() => jest.clearAllMocks());

  it('creates a jsPDF sized to the requested ISO sheet + orientation', async () => {
    await assemblePrintPdf({
      capture: CAPTURE,
      paper: { size: 'A3', orientation: 'landscape' },
      marginMm: 10,
      includeTitleBlock: false,
    });
    expect(jsPDF).toHaveBeenCalledWith(
      expect.objectContaining({ orientation: 'landscape', unit: 'mm', format: 'a3' }),
    );
  });

  it('registers the Greek font BEFORE drawing anything', async () => {
    await assemblePrintPdf({
      capture: CAPTURE,
      paper: { size: 'A4', orientation: 'portrait' },
      marginMm: 10,
      includeTitleBlock: false,
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
      marginMm: 10,
      includeTitleBlock: false,
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
  // instead of rasterising a PNG.
  it('draws a vector capture into the printable area and skips addImage', async () => {
    const draw = jest.fn();
    const vectorCapture: CaptureResult = {
      kind: 'vector',
      appliedScaleDenominator: 50,
      draw,
    };
    await assemblePrintPdf({
      capture: vectorCapture,
      paper: { size: 'A3', orientation: 'landscape' },
      marginMm: 10,
      includeTitleBlock: false,
    });
    const ctor = jsPDF as unknown as jest.Mock;
    const instance = ctor.mock.results[0].value;
    expect(draw).toHaveBeenCalledTimes(1);
    expect(draw).toHaveBeenCalledWith(
      instance,
      expect.objectContaining({
        xMm: expect.any(Number),
        yMm: expect.any(Number),
        widthMm: expect.any(Number),
        heightMm: expect.any(Number),
      }),
    );
    expect(instance.addImage).not.toHaveBeenCalled();
  });
});
