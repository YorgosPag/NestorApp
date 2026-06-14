/**
 * ADR-453 — print-service tests: source routing + output routing + SSoT
 * convergence (both 2D and 3D must hit the SAME assembler).
 */

import { runPrint, type PrintDeps } from '../print-service';
import { captureCurrent2dView } from '../capture/capture-2d';
import { assemblePrintPdf } from '../assemble/pdf-assembler';
import { triggerExportDownload, openBlobInNewTab } from '@/lib/exports/trigger-export-download';
import type { CaptureResult } from '../capture/capture-types';
import type { PrintRequest } from '../config/paper-types';

jest.mock('../capture/capture-2d', () => ({
  captureCurrent2dView: jest.fn(),
}));
jest.mock('../assemble/pdf-assembler', () => ({
  assemblePrintPdf: jest.fn(),
}));
jest.mock('@/lib/exports/trigger-export-download', () => ({
  triggerExportDownload: jest.fn(),
  openBlobInNewTab: jest.fn(),
}));

const CAPTURE_2D: CaptureResult = { dataUrl: 'd2', widthPx: 10, heightPx: 10, appliedScaleDenominator: null };
const CAPTURE_3D: CaptureResult = { dataUrl: 'd3', widthPx: 10, heightPx: 10, appliedScaleDenominator: null };
const PDF_BLOB = new Blob(['pdf'], { type: 'application/pdf' });

const baseDeps: PrintDeps = {
  scene: null,
  projectName: 'Demo',
  dateStr: '2026-06-14',
};

function req(overrides: Partial<PrintRequest>): PrintRequest {
  return {
    source: '2d',
    paper: { size: 'A3', orientation: 'landscape' },
    fitMode: 'fit-to-page',
    target: 'save-pdf',
    includeTitleBlock: false,
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  (captureCurrent2dView as jest.Mock).mockReturnValue(CAPTURE_2D);
  (assemblePrintPdf as jest.Mock).mockResolvedValue(PDF_BLOB);
});

describe('runPrint — source routing', () => {
  it('uses the 2D adapter for source=2d and downloads with a built filename', async () => {
    await runPrint(req({ source: '2d', target: 'save-pdf' }), baseDeps);
    expect(captureCurrent2dView).toHaveBeenCalledTimes(1);
    expect(assemblePrintPdf).toHaveBeenCalledWith(
      expect.objectContaining({ capture: CAPTURE_2D, paper: { size: 'A3', orientation: 'landscape' } }),
    );
    expect(triggerExportDownload).toHaveBeenCalledWith(
      expect.objectContaining({ blob: PDF_BLOB, filename: 'Demo_A3_2026-06-14.pdf' }),
    );
  });

  it('uses the injected 3D provider for source=3d', async () => {
    const capture3d = jest.fn().mockResolvedValue(CAPTURE_3D);
    await runPrint(req({ source: '3d' }), { ...baseDeps, capture3d });
    expect(capture3d).toHaveBeenCalledTimes(1);
    expect(captureCurrent2dView).not.toHaveBeenCalled();
    expect(assemblePrintPdf).toHaveBeenCalledWith(
      expect.objectContaining({ capture: CAPTURE_3D }),
    );
  });

  it('throws if a 3D print is requested without a provider', async () => {
    await expect(runPrint(req({ source: '3d' }), baseDeps)).rejects.toThrow();
  });
});

describe('runPrint — output routing', () => {
  it('opens a print tab for target=open-print', async () => {
    await runPrint(req({ target: 'open-print' }), baseDeps);
    expect(openBlobInNewTab).toHaveBeenCalledWith(PDF_BLOB, expect.objectContaining({ onLoad: expect.any(Function) }));
    expect(triggerExportDownload).not.toHaveBeenCalled();
  });
});

describe('title block composition', () => {
  it('passes a composed title block when includeTitleBlock + deps.titleBlock', async () => {
    (captureCurrent2dView as jest.Mock).mockReturnValue({
      ...CAPTURE_2D,
      appliedScaleDenominator: 100,
    });
    await runPrint(
      req({ source: '2d', includeTitleBlock: true, fitMode: 'drawing-scale', scaleDenominator: 100 }),
      {
        ...baseDeps,
        titleBlock: { project: 'Demo', labels: { scale: 'Κλίμακα', date: 'Ημ/νία', sheet: 'Φύλλο' } },
      },
    );
    const arg = (assemblePrintPdf as jest.Mock).mock.calls[0][0];
    expect(arg.titleBlock.heading).toBe('Demo');
    expect(arg.titleBlock.fields).toEqual([
      { label: 'Κλίμακα', value: '1:100' },
      { label: 'Ημ/νία', value: '2026-06-14' },
      { label: 'Φύλλο', value: 'A3 · landscape' },
    ]);
  });

  it('omits the title block when includeTitleBlock is false', async () => {
    await runPrint(req({ includeTitleBlock: false }), {
      ...baseDeps,
      titleBlock: { project: 'Demo', labels: { scale: 's', date: 'd', sheet: 'sh' } },
    });
    expect((assemblePrintPdf as jest.Mock).mock.calls[0][0].titleBlock).toBeUndefined();
  });
});

describe('SSoT convergence', () => {
  it('routes BOTH 2D and 3D through the same assemblePrintPdf', async () => {
    const capture3d = jest.fn().mockResolvedValue(CAPTURE_3D);
    await runPrint(req({ source: '2d' }), baseDeps);
    await runPrint(req({ source: '3d' }), { ...baseDeps, capture3d });
    expect(assemblePrintPdf).toHaveBeenCalledTimes(2);
    expect((assemblePrintPdf as jest.Mock).mock.calls[0][0].capture).toBe(CAPTURE_2D);
    expect((assemblePrintPdf as jest.Mock).mock.calls[1][0].capture).toBe(CAPTURE_3D);
  });
});
