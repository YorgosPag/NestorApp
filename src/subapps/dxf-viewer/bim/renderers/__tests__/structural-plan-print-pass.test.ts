/**
 * ADR-909 Γ2.5 (Η1 · Η3) — κολόνα, άνοιγμα πλάκας και άνοιγμα, **μέσα από τους πραγματικούς ζωγράφους τους**:
 * η γραμμοσκίαση υλικού και το πάχος των Object Styles όπως φτάνουν στον καμβά.
 *
 * Πριν, στη δημόσια κάτοψη: η γραμμοσκίαση της κολόνας `#cccccc`, 1,6:1 προς το χαρτί (`K2:*:column`)· το
 * περίγραμμα του ανοίγματος πλάκας 3,55 px (`K3:*:slab-opening`).
 *
 * Δ1 οθόνη όπως πριν · Δ2 δημόσια κάτοψη ⇒ κάθε γραμμή πλήρες μελάνι ≥ 3:1 και ποτέ κάτω από το δάπεδο πάχους,
 * άχρωμη στις άχρωμες στάθμες, και τίποτε δεν χάθηκε · Δ3 το PDF του μηχανικού χωρίς δάπεδο 4 px.
 */

jest.mock('firebase/auth', () => ({
  __esModule: true,
  getAuth: () => ({ currentUser: null }),
  onAuthStateChanged: (_a: unknown, cb: (u: null) => void) => { cb(null); return () => {}; },
  signInAnonymously: jest.fn(),
}));

import { ColumnRenderer } from '../ColumnRenderer';
import { OpeningRenderer } from '../OpeningRenderer';
import { SlabOpeningRenderer } from '../SlabOpeningRenderer';
import { MIN_ENTITY_CONTRAST } from '../../../config/contrast-adaptation';
import { lineweightToPx } from '../../../config/lineweight-iso-catalog';
import { clearPrintColorPolicy, setPrintColorPolicy, type PrintColorPolicy } from '../../../config/print-color-policy';
import { MATERIAL_HATCH_LINE_WIDTH_PX, MATERIAL_HATCH_STROKE_RGBA } from '../shared/material-hatch-paint';
import { ENGINEER_PDF, FLOOR_PX, PLOT_STYLES, isGrey, isOpaque, onPaper, publicImage } from './print-pass-policies';
import type { Painted } from './recording-canvas';
import { paintedBy, sampleColumn, sampleOpening, sampleSlabOpening, sampleWall } from './structural-samples';

/** Η πένα του περιγράμματος του ανοίγματος πλάκας στο 1:100 (πένα 3). */
const SLAB_OPENING_PEN_MM = 0.13;
/**
 * Χαρτί στα 300 dpi — DPI **αυτής** της άγκυρας, με όνομα (ADR-909 Γ2.6α Θ9): εδώ η πένα των 0,13 mm βγαίνει
 * 1,5 px, πάνω από την τρίχα, άρα φαίνεται αυτούσια. Το `ENGINEER_PDF` ακολουθεί πλέον το `EXPORT_DPI` (150).
 */
const PLOTTER_300_DPI: PrintColorPolicy = { style: 'monochrome', dpi: 300 };

const wall = sampleWall();
const SAMPLES: ReadonlyArray<readonly [string, () => Painted]> = [
  ['column', () => paintedBy((ctx) => new ColumnRenderer(ctx), sampleColumn())],
  ['slab-opening', () => paintedBy((ctx) => new SlabOpeningRenderer(ctx), sampleSlabOpening())],
  ['opening', () => paintedBy((ctx) => new OpeningRenderer(ctx), sampleOpening(wall))],
];

afterEach(clearPrintColorPolicy);

describe.each(SAMPLES)('δομικό «%s» στο χαρτί (ADR-909 Γ2.5)', (_name, paint) => {
  it.each(PLOT_STYLES)('Δ2 🔴 δημόσια κάτοψη «%s»: πλήρες μελάνι ≥ 3:1, ποτέ κάτω από το δάπεδο — και τίποτε δεν χάθηκε', (style) => {
    const onScreen = paint();
    setPrintColorPolicy(publicImage(style));
    const printed = paint();
    expect(printed.strokes.length).toBeGreaterThan(0);
    expect(printed.strokes).toHaveLength(onScreen.strokes.length);
    for (const s of printed.strokes) {
      expect(s.width).toBeGreaterThanOrEqual(FLOOR_PX);
      expect(isOpaque(s.ink)).toBe(true);
      expect(onPaper(s.ink)).toBeGreaterThanOrEqual(MIN_ENTITY_CONTRAST);
      if (style !== 'colour') expect(isGrey(s.ink)).toBe(true);
    }
  });

  it('`save` / `restore` ζευγαρώνουν, στην οθόνη και στο χαρτί', () => {
    const onScreen = paint();
    setPrintColorPolicy(publicImage('monochrome'));
    const printed = paint();
    expect(onScreen.restores).toBe(onScreen.saves);
    expect(printed.restores).toBe(printed.saves);
  });
});

describe('κολόνα — γραμμοσκίαση υλικού (ADR-909 Γ2.5 Η1)', () => {
  const [, paint] = SAMPLES[0];

  it('Δ1 οθόνη όπως πριν: αχνή `0.20`, 0,5 px', () => {
    expect(paint().strokes).toContainEqual({ ink: MATERIAL_HATCH_STROKE_RGBA, width: MATERIAL_HATCH_LINE_WIDTH_PX, dash: [] });
  });

  it('Δ2 🔴 «Ασπρόμαυρο»: μαύρη στο δάπεδο πάχους — όχι `#cccccc`', () => {
    setPrintColorPolicy(publicImage('monochrome'));
    expect(paint().strokes).toContainEqual({ ink: '#000000', width: FLOOR_PX, dash: [] });
  });

  it('Δ3 PDF του μηχανικού: μαύρη, χωρίς δάπεδο 4 px', () => {
    setPrintColorPolicy(ENGINEER_PDF);
    expect(paint().strokes).toContainEqual({ ink: '#000000', width: 1, dash: [] });
  });
});

describe('άνοιγμα πλάκας — πάχος από τα Object Styles (ADR-909 Γ2.5 Η3)', () => {
  const [, paint] = SAMPLES[1];

  it('Δ1 οθόνη όπως πριν: το χρώμα του είδους, η πένα του στα 96 dpi, η παύλα του', () => {
    expect(paint().strokes).toStrictEqual([
      { ink: '#1f3a5f', width: lineweightToPx(SLAB_OPENING_PEN_MM, 96), dash: [8, 4] },
    ]);
  });

  it.each(PLOT_STYLES)('Δ2 🔴 δημόσια κάτοψη «%s»: ακριβώς στο δάπεδο — όχι 3,55 px', (style) => {
    setPrintColorPolicy(publicImage(style));
    const [outline] = paint().strokes;
    expect(lineweightToPx(SLAB_OPENING_PEN_MM, publicImage(style).dpi)).toBeLessThan(FLOOR_PX);
    expect(outline.width).toBe(FLOOR_PX);
    expect(outline.dash).toStrictEqual([8, 4]);
  });

  it('Δ3 χαρτί στα 300 dpi: η πένα του αυτούσια (1,5 px), κάτω από τα 4 px', () => {
    setPrintColorPolicy(PLOTTER_300_DPI);
    const [outline] = paint().strokes;
    expect(outline.width).toBe(lineweightToPx(SLAB_OPENING_PEN_MM, PLOTTER_300_DPI.dpi));
    expect(outline.width).toBeGreaterThan(1);
    expect(outline.width).toBeLessThan(FLOOR_PX);
  });

  it('Δ4 PDF του μηχανικού όπως εξάγεται (150 dpi): η πένα πέφτει κάτω από 1 px ⇒ κάθεται στο δάπεδο της τρίχας', () => {
    setPrintColorPolicy(ENGINEER_PDF);
    const [outline] = paint().strokes;
    expect(lineweightToPx(SLAB_OPENING_PEN_MM, ENGINEER_PDF.dpi)).toBeLessThan(1);
    expect(outline.width).toBe(1);
  });
});
