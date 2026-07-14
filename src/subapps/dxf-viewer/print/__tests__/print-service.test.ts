/**
 * ADR-453 — print-service tests: source routing + output routing + SSoT
 * convergence (both 2D and 3D must hit the SAME assembler).
 */

import { runPrint, runPrintSet, type PrintDeps } from '../print-service';
import { captureCurrent2dView } from '../capture/capture-2d';
import { captureCurrent2dViewVector } from '../capture/capture-2d-vector';
import { assemblePrintPdf, assemblePrintPdfPages } from '../assemble/pdf-assembler';
import { triggerExportDownload, openBlobInNewTab } from '@/lib/exports/trigger-export-download';
import type { CaptureResult } from '../capture/capture-types';
import type { PrintRequest } from '../config/paper-types';
import type { SheetSetItem } from '../../text-engine/title-block/sheet-set';
import type { SceneModel } from '../../types/entities';

jest.mock('../capture/capture-2d', () => ({
  captureCurrent2dView: jest.fn(),
}));
jest.mock('../capture/capture-2d-vector', () => ({
  captureCurrent2dViewVector: jest.fn(),
}));
jest.mock('../assemble/pdf-assembler', () => ({
  assemblePrintPdf: jest.fn(),
  assemblePrintPdfPages: jest.fn(),
}));
jest.mock('@/lib/exports/trigger-export-download', () => ({
  triggerExportDownload: jest.fn(),
  openBlobInNewTab: jest.fn(),
}));

const CAPTURE_2D: CaptureResult = { kind: 'raster', dataUrl: 'd2', widthPx: 10, heightPx: 10, appliedScaleDenominator: null };
const CAPTURE_2D_VECTOR: CaptureResult = { kind: 'vector', draw: jest.fn(), appliedScaleDenominator: null };
const CAPTURE_3D: CaptureResult = { kind: 'raster', dataUrl: 'd3', widthPx: 10, heightPx: 10, appliedScaleDenominator: null };
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
  (captureCurrent2dViewVector as jest.Mock).mockReturnValue(CAPTURE_2D_VECTOR);
  (assemblePrintPdf as jest.Mock).mockResolvedValue(PDF_BLOB);
  (assemblePrintPdfPages as jest.Mock).mockResolvedValue(PDF_BLOB);
});

describe('runPrint — source routing', () => {
  // ADR-608 — 2D defaults to the vector adapter (no outputMode set).
  it('uses the 2D VECTOR adapter by default and downloads with a built filename', async () => {
    await runPrint(req({ source: '2d', target: 'save-pdf' }), baseDeps);
    expect(captureCurrent2dViewVector).toHaveBeenCalledTimes(1);
    expect(captureCurrent2dView).not.toHaveBeenCalled();
    expect(assemblePrintPdf).toHaveBeenCalledWith(
      expect.objectContaining({ capture: CAPTURE_2D_VECTOR, paper: { size: 'A3', orientation: 'landscape' } }),
    );
    expect(triggerExportDownload).toHaveBeenCalledWith(
      expect.objectContaining({ blob: PDF_BLOB, filename: 'Demo_A3_2026-06-14.pdf' }),
    );
  });

  // ADR-608 — the raster fallback keeps the legacy PNG-into-PDF path.
  it('uses the 2D RASTER adapter when outputMode=raster', async () => {
    await runPrint(req({ source: '2d', outputMode: 'raster' }), baseDeps);
    expect(captureCurrent2dView).toHaveBeenCalledTimes(1);
    expect(captureCurrent2dViewVector).not.toHaveBeenCalled();
    expect(assemblePrintPdf).toHaveBeenCalledWith(
      expect.objectContaining({ capture: CAPTURE_2D }),
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

/**
 * ADR-651 Φάση ΣΤ — η πινακίδα του PDF ΔΕΝ συντίθεται πια εδώ με «φτωχά» δεδομένα: το print
 * διαβάζει το ΙΔΙΟ layout model της οθόνης (preset store + scope cache) και τυπώνει κορνίζα
 * ISO 5457 + πινακίδα. Άρα εδώ ελέγχουμε το ΣΥΜΒΟΛΑΙΟ: primitives στη σελίδα + το σχέδιο
 * μέσα στην ωφέλιμη περιοχή (ποτέ κάτω από την πινακίδα).
 */
describe('title block + sheet frame (ADR-651 Φάση ΣΤ)', () => {
  const A3_LANDSCAPE_WIDTH_MM = 420;
  const A3_LANDSCAPE_HEIGHT_MM = 297;

  it('prints the sheet primitives and confines the drawing to the usable area', async () => {
    await runPrint(
      req({ source: '2d', includeTitleBlock: true, fitMode: 'drawing-scale', scaleDenominator: 100 }),
      { ...baseDeps, titleBlockLocale: 'el' },
    );
    const arg = (assemblePrintPdf as jest.Mock).mock.calls[0][0];

    // Κορνίζα + πινακίδα ζωγραφίζονται από το ΚΟΙΝΟ μοντέλο (DetailPrimitive[], ADR-622).
    expect(arg.sheetPrimitives.length).toBeGreaterThan(0);

    // Η περιοχή του σχεδίου είναι η ωφέλιμη: μέσα στα περιθώρια ISO 5457, ποτέ όλο το φύλλο.
    expect(arg.area.xMm).toBeGreaterThan(0);
    expect(arg.area.widthMm).toBeLessThan(A3_LANDSCAPE_WIDTH_MM);
    expect(arg.area.heightMm).toBeLessThan(A3_LANDSCAPE_HEIGHT_MM);
  });

  it('γράφει στην πινακίδα την κλίμακα που ΤΥΠΩΝΕΤΑΙ (1:N του διαλόγου)', async () => {
    await runPrint(
      req({ source: '2d', includeTitleBlock: true, fitMode: 'drawing-scale', scaleDenominator: 50 }),
      { ...baseDeps, titleBlockLocale: 'el' },
    );
    const arg = (assemblePrintPdf as jest.Mock).mock.calls[0][0];
    const texts = arg.sheetPrimitives
      .filter((p: { kind: string }) => p.kind === 'text')
      .map((p: { text: string }) => p.text);
    expect(texts.some((text: string) => text.includes('1:50'))).toBe(true);
  });

  it('omits the sheet when includeTitleBlock is false (drawing keeps the full margin area)', async () => {
    await runPrint(req({ includeTitleBlock: false }), { ...baseDeps, titleBlockLocale: 'el' });
    const arg = (assemblePrintPdf as jest.Mock).mock.calls[0][0];
    expect(arg.sheetPrimitives).toBeUndefined();
    expect(arg.area).toEqual({ xMm: 10, yMm: 10, widthMm: 400, heightMm: 277 });
  });

  it('omits the sheet outside a React host (no title-block locale)', async () => {
    await runPrint(req({ includeTitleBlock: true }), baseDeps);
    expect((assemblePrintPdf as jest.Mock).mock.calls[0][0].sheetPrimitives).toBeUndefined();
  });
});

describe('SSoT convergence', () => {
  it('routes BOTH 2D and 3D through the same assemblePrintPdf', async () => {
    const capture3d = jest.fn().mockResolvedValue(CAPTURE_3D);
    await runPrint(req({ source: '2d' }), baseDeps);
    await runPrint(req({ source: '3d' }), { ...baseDeps, capture3d });
    expect(assemblePrintPdf).toHaveBeenCalledTimes(2);
    expect((assemblePrintPdf as jest.Mock).mock.calls[0][0].capture).toBe(CAPTURE_2D_VECTOR);
    expect((assemblePrintPdf as jest.Mock).mock.calls[1][0].capture).toBe(CAPTURE_3D);
  });
});

/**
 * ADR-651 Φάση Ζ — «σετ φύλλων»: το ΙΔΙΟ 2D capture + ο ΙΔΙΟΣ (πλέον πολυσέλιδος)
 * assembler, ένα φύλλο ανά όροφο. Εδώ ελέγχουμε το ΣΥΜΒΟΛΑΙΟ: μία σελίδα ανά φύλλο,
 * κάθε φύλλο capture-άρεται ξεχωριστά, όλα σε ΕΝΑ PDF (μία έξοδος).
 */
describe('runPrintSet — multi-page sheet set', () => {
  function sheet(scene: SceneModel, sheetNumber: string, title: string): SheetSetItem {
    // ADR-651 Φάση Ι — το φύλλο κουβαλά το levelId του (ταυτότητα για το write-back).
    return { levelId: `lvl-${sheetNumber}`, scene, sheetNumber, title };
  }
  const SCENE_A = { entities: [] } as unknown as SceneModel;
  const SCENE_B = { entities: [] } as unknown as SceneModel;
  const SCENE_C = { entities: [] } as unknown as SceneModel;

  it('produces one page per sheet and a single combined PDF output', async () => {
    const sheets = [
      sheet(SCENE_A, 'Α-1', 'Ισόγειο'),
      sheet(SCENE_B, 'Α-2', 'Α΄ Όροφος'),
      sheet(SCENE_C, 'Α-3', 'Β΄ Όροφος'),
    ];
    await runPrintSet(req({ source: '2d' }), baseDeps, sheets);

    // Κάθε φύλλο capture-άρεται ξεχωριστά (2Δ vector default), σε ΕΝΑ assembler call.
    expect(captureCurrent2dViewVector).toHaveBeenCalledTimes(3);
    expect(assemblePrintPdfPages).toHaveBeenCalledTimes(1);
    const [pages, paper] = (assemblePrintPdfPages as jest.Mock).mock.calls[0];
    expect(pages).toHaveLength(3);
    expect(paper).toEqual({ size: 'A3', orientation: 'landscape' });

    // Μία έξοδος για όλο το σετ (ένα αρχείο).
    expect(triggerExportDownload).toHaveBeenCalledTimes(1);
    expect(triggerExportDownload).toHaveBeenCalledWith(
      expect.objectContaining({ blob: PDF_BLOB }),
    );
  });

  it('writes each sheet number/title into its own title block page (WYSIWYG)', async () => {
    const sheets = [sheet(SCENE_A, 'Α-1', 'Ισόγειο'), sheet(SCENE_B, 'Α-2', 'Α΄ Όροφος')];
    await runPrintSet(
      req({ source: '2d', includeTitleBlock: true }),
      { ...baseDeps, titleBlockLocale: 'el' },
      sheets,
    );
    const [pages] = (assemblePrintPdfPages as jest.Mock).mock.calls[0];
    const pageTexts = (index: number): string[] =>
      pages[index].sheetPrimitives
        .filter((p: { kind: string }) => p.kind === 'text')
        .map((p: { text: string }) => p.text);

    // Το φύλλο 1 φέρει «Α-1»/«Ισόγειο», το φύλλο 2 «Α-2»/«Α΄ Όροφος» — διακριτές πινακίδες.
    expect(pageTexts(0).some((x) => x.includes('Α-1'))).toBe(true);
    expect(pageTexts(0).some((x) => x.includes('Ισόγειο'))).toBe(true);
    expect(pageTexts(1).some((x) => x.includes('Α-2'))).toBe(true);
    expect(pageTexts(1).some((x) => x.includes('Α΄ Όροφος'))).toBe(true);
  });

  it('throws on an empty sheet set (nothing to print)', async () => {
    await expect(runPrintSet(req({ source: '2d' }), baseDeps, [])).rejects.toThrow();
  });
});
