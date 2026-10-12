/**
 * ADR-909 Γ2.7 — **το vector PDF στο χαρτί**: τι μελάνι στέλνει, από ποιον δρόμο, και τι ΔΕΝ στέλνει.
 *
 * Οι άγκυρες των ζωγράφων (`bim/renderers/__tests__/*-print-pass`) κρίνουν τον **καμβά**. Το vector PDF δεν
 * περνά από εκεί: διασπά τη σκηνή σε πρωτογενή και γράφει με jsPDF. Άρα ό,τι αποδείχθηκε για τους ζωγράφους
 * **δεν** αποδεικνύει τίποτα για αυτόν τον δρόμο — χρειάζεται δική του μέτρηση.
 *
 * Εδώ τρέχει η **πραγματική** `captureCurrent2dViewVector` (καμία απομίμηση συνεργάτη εκτός από την
 * αποκωδικοποίηση εικόνας, που το jsdom δεν έχει) πάνω στο **ίδιο** σχέδιο-δείγμα με την πύλη pixels
 * (`buildPixelGateSampleScene` — όχι δεύτερο σετ δειγμάτων), και ένα πλαστό jsPDF καταγράφει κάθε κλήση.
 */

import { PRINT_PLOT_STYLES, type PrintPlotStyle } from '../../config/print-color-policy';
import { RENDERABLE_ENTITY_TYPES, type RenderableEntityType } from '../../rendering/contract/renderable-entity-type';
import type { SceneModel } from '../../types/entities';
import { prepareScene2dCapture, renderDxfSceneOffscreen, type Capture2dInput } from '../capture/capture-2d';
import { captureCurrent2dViewVector } from '../capture/capture-2d-vector';
import { EXPORT_DPI } from '../config/paper-constants';
import type { PrintableAreaMm } from '../config/paper-types';
import { PIXEL_GATE_SAMPLES, buildPixelGateSampleScene } from '../public-floorplan/pixel-gate/pixel-gate-samples';
import type { CellGeometry } from '../public-floorplan/pixel-gate/pixel-gate-sample-kit';
import { recordingPdf, inkOf, isAchromatic, type PdfCall } from './recording-pdf';

const OFFSCREEN_TRAP = 'vector PDF: ζητήθηκε καμβάς εκτός οθόνης';

// Ο ΜΟΝΟΣ δρόμος προς ζωγράφο καμβά είναι ο εκτός οθόνης στόχος του raster. Όποιος τον ζητήσει, σκάει.
jest.mock('../capture/capture-2d-offscreen-canvas', () => ({
  createOffscreen2dTarget: jest.fn(() => {
    throw new Error('vector PDF: ζητήθηκε καμβάς εκτός οθόνης');
  }),
}));
// Το jsdom δεν αποκωδικοποιεί εικόνες: χωρίς αυτό η «γυμνή» εικόνα θα έλειπε από το PDF για λόγο του
// περιβάλλοντος, και ο κατάλογος Ζ1 θα τη δήλωνε κενό του προϊόντος.
jest.mock('../../export/core/image-export-shared', () => ({
  ...jest.requireActual('../../export/core/image-export-shared'),
  decodeImageWithTimeout: jest.fn(async () => document.createElement('canvas')),
}));
// Ίδιος λόγος για τη ράμπα του γκρι (θέλει Canvas 2D): εδώ κρίνεται ο δρόμος, όχι τα pixels της εικόνας.
jest.mock('../../rendering/entities/shared/hatch-image-tint', () => ({
  ...jest.requireActual('../../rendering/entities/shared/hatch-image-tint'),
  toGrayscaleImage: jest.fn(() => document.createElement('canvas')),
}));

const AREA: PrintableAreaMm = { xMm: 10, yMm: 10, widthMm: 400, heightMm: 277 };
const RASTER = { widthPx: 2362, heightPx: 1636, effectiveDpi: EXPORT_DPI };

/** Κελί 3 × 3 m — τα ίδια σημεία αναφοράς που δίνει η πύλη pixels στα εργοστάσιά της. */
const CELL: CellGeometry = {
  centre: { x: 2500, y: 2500 }, from: { x: 1000, y: 2500 }, to: { x: 4000, y: 2500 },
  ring: [{ x: 1000, y: 1000 }, { x: 4000, y: 1000 }, { x: 4000, y: 4000 }, { x: 1000, y: 4000 }],
};

const SAMPLE = buildPixelGateSampleScene();

const inputOf = (scene: SceneModel, plotStyle: PrintPlotStyle): Capture2dInput => ({
  scene, raster: RASTER, fitMode: 'fit-to-page', plotStyle,
});

async function emit(scene: SceneModel, plotStyle: PrintPlotStyle): Promise<PdfCall[]> {
  const capture = await captureCurrent2dViewVector(inputOf(scene, plotStyle));
  if (capture.kind !== 'vector') throw new Error('expected a vector capture');
  const { pdf, calls } = recordingPdf();
  capture.draw(pdf, AREA);
  return calls;
}

/** Ό,τι αφήνει σημάδι στη σελίδα (όχι ρυθμίσεις κατάστασης). */
const MARKS = new Set(['line', 'lines', 'circle', 'text', 'addImage', 'fillEvenOdd']);
const marksOf = (calls: readonly PdfCall[]): PdfCall[] => calls.filter((c) => MARKS.has(c.fn));

/** Τα σημάδια που αφήνει ΕΝΑ δείγμα της πύλης, μόνο του στο σχέδιο. */
async function marksOfSample(type: RenderableEntityType): Promise<string[]> {
  const factory = PIXEL_GATE_SAMPLES[type];
  if (factory === null) throw new Error(`no pixel-gate sample for "${type}"`);
  return marksOf(await emit({ ...SAMPLE.scene, entities: factory(CELL) }, 'colour')).map((c) => c.fn);
}

let toDataURL: jest.SpyInstance;

beforeAll(() => {
  toDataURL = jest.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue('data:image/png;base64,AA==');
});
afterAll(() => toDataURL.mockRestore());

describe('ADR-909 Γ2.7 — το vector PDF δεν καλεί ζωγράφο καμβά', () => {
  it('Δ1 ολόκληρο το σχέδιο-δείγμα εκπέμπεται χωρίς καμβά εκτός οθόνης· 2D context ζητά ΜΟΝΟ ο μετρητής κειμένου', async () => {
    // Κάθε κλήση κρατά το stack της: αν κάποιος ζητήσει 2D context, η αποτυχία λέει ΠΟΙΟΣ.
    const askedBy: string[] = [];
    const getContext = jest.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => {
      askedBy.push(new Error('getContext').stack ?? '');
      return null;
    });
    try {
      const calls = await emit(SAMPLE.scene, 'monochrome');
      expect(marksOf(calls).length).toBeGreaterThan(100);
      // Ο μετρητής πλάτους κειμένου (`text-advance`) ζητά context για `measureText` — δεν ζωγραφίζει.
      expect(askedBy.filter((stack) => !stack.includes('text-advance'))).toEqual([]);
    } finally {
      getContext.mockRestore();
    }
  });

  it('Δ2 μάρτυρας: ο raster δρόμος, στο ΙΔΙΟ σχέδιο, πέφτει στην παγίδα — άρα η παγίδα στέκεται εκεί που περνούν οι ζωγράφοι', () => {
    const input = inputOf(SAMPLE.scene, 'monochrome');
    const { dxfScene, viewport } = prepareScene2dCapture(input);
    expect(() => renderDxfSceneOffscreen(dxfScene, viewport, input)).toThrow(OFFSCREEN_TRAP);
  });
});

describe('ADR-909 Γ2.7 — το μελάνι του vector PDF ανά στάθμη', () => {
  it('Ε1 «Ασπρόμαυρο»: κάθε χρώμα γραμμής και γεμίσματος είναι άχρωμο', async () => {
    const chromatic = inkOf(await emit(SAMPLE.scene, 'monochrome')).filter((ink) => !isAchromatic(ink));
    expect(chromatic).toEqual([]);
  });

  it('Ε2 «Ασπρόμαυρο»: κάθε χρώμα **γραμμής** είναι μαύρο', async () => {
    const strokes = inkOf(await emit(SAMPLE.scene, 'monochrome')).filter((ink) => ink.fn === 'setDrawColor');
    expect(strokes.length).toBeGreaterThan(0);
    expect(strokes.filter((ink) => ink.r + ink.g + ink.b !== 0)).toEqual([]);
  });

  it('Ε3 «Γκρι»: κάθε χρώμα γραμμής και γεμίσματος είναι άχρωμο', async () => {
    const chromatic = inkOf(await emit(SAMPLE.scene, 'grayscale')).filter((ink) => !isAchromatic(ink));
    expect(chromatic).toEqual([]);
  });

  it('Ε4 μάρτυρας: στο «Έγχρωμο» το ΙΔΙΟ όργανο βλέπει χρώμα — αλλιώς τα Ε1–Ε3 δεν μετρούν τίποτα', async () => {
    const chromatic = inkOf(await emit(SAMPLE.scene, 'colour')).filter((ink) => !isAchromatic(ink));
    expect(chromatic.length).toBeGreaterThan(0);
  });

  it('Ε5 το στυλ δεν αλλάζει τη γεωμετρία: ίδια σημάδια σε κάθε στάθμη', async () => {
    const counts = await Promise.all(
      PRINT_PLOT_STYLES.map(async (style) => marksOf(await emit(SAMPLE.scene, style)).length),
    );
    expect(new Set(counts).size).toBe(1);
  });
});

/**
 * 🔴 ΔΗΛΩΜΕΝΟ ΟΡΙΟ του vector PDF (ADR-608 / ADR-505 §A), **μετρημένο** εδώ για πρώτη φορά: το κοινό flatten
 * (`flattenSceneEntitiesForDxf`) δίνει ανά στοιχείο BIM **ένα κλειστό περίγραμμα κάτοψης**, και για όσα δεν έχουν
 * `footprint` / `outline` / `polygon` **τίποτα**. Η αιτία ζει εκεί, όχι στο Γ2· εδώ μόνο ονομάζεται, ώστε να
 * πάψει να είναι σιωπηλή. Κάθε γραμμή που φεύγει από αυτόν τον κατάλογο είναι κέρδος — και κοκκινίζει το Ζ1
 * ώστε να σβηστεί και από εδώ.
 */
const NOT_IN_VECTOR_PDF: readonly RenderableEntityType[] = [
  // Σκέτο DXF: ο emitter δεν έχει κλάδο (`default → skip`).
  'ellipse', 'spline', 'point', 'xline', 'ray', 'leader',
  // Σχολιασμός που ούτε το flatten ούτε η αποδόμηση σχολιασμών τον πιάνει (ADR-648 §2: `missing`).
  'angle-measurement', 'opening-info-tag', 'topo-surface',
  // BIM χωρίς πολύγωνο κάτοψης στη γεωμετρία του.
  'stair', 'railing', 'floor-finish', 'thermal-space', 'space-separator', 'mep-underfloor',
];

describe('ADR-909 Γ2.7 — τι ΔΕΝ φτάνει στο vector PDF (δηλωμένο όριο, μετρημένο)', () => {
  it('Ζ1 ο κατάλογος των τύπων που λείπουν εντελώς είναι ΑΚΡΙΒΩΣ αυτός — νέο κενό ή κλεισμένο κενό κοκκινίζει', async () => {
    const silent: string[] = [];
    for (const type of RENDERABLE_ENTITY_TYPES) {
      if (PIXEL_GATE_SAMPLES[type] === null) continue;
      if ((await marksOfSample(type)).length === 0) silent.push(type);
    }
    expect(silent.sort()).toEqual([...NOT_IN_VECTOR_PDF].sort());
  });

  it.each(['wall', 'column', 'slab', 'beam', 'furniture', 'mep-radiator', 'floorplan-symbol'] as const)(
    'Ζ2 «%s»: ό,τι φτάνει από ένα στοιχείο BIM είναι ΕΝΑ κλειστό περίγραμμα — όχι το σχέδιό του',
    async (type) => {
      expect(await marksOfSample(type)).toEqual(['lines']);
    },
  );
});
