/**
 * ADR-909 Γ2.5 (Η2 · Η4) — ο `WallRenderer` στο χαρτί: ο άξονας ΔΕΝ τυπώνεται, και τα σταθερά πάχη σε px
 * (γραμμές στρώσεων, όψη «Μόνο κάτοψη») ρωτούν το δάπεδο της απόδοσης.
 *
 * Πριν: ο άξονας (`RENDER_LINE_WIDTHS.THIN`, διακεκομμένος) έβγαινε τρίχα 1 px στη δημόσια κάτοψη των 4096 px —
 * και μέσα από τον τοίχο-ξενιστή χρεωνόταν και στο άνοιγμα και στην επένδυση (πύλη pixels: `K3:*:wall` ·
 * `K3:*:opening` · `K3:*:wall-covering`).
 *
 * Τ1 οθόνη όπως πριν: άξονας 1 px διακεκομμένος · Τ2 print pass ⇒ χωρίς άξονα, και τίποτε άλλο δεν χάθηκε ·
 * Τ3 γραμμές στρώσεων: οθόνη αχνές 1 px, χαρτί πλήρες μελάνι στο δάπεδο · Τ4 «Μόνο κάτοψη»: οθόνη 1 px, χαρτί στο
 * δάπεδο · Τ5 το PDF του μηχανικού: χωρίς άξονα, χωρίς δάπεδο 4 px.
 */

jest.mock('firebase/auth', () => ({
  __esModule: true,
  getAuth: () => ({ currentUser: null }),
  onAuthStateChanged: (_a: unknown, cb: (u: null) => void) => { cb(null); return () => {}; },
  signInAnonymously: jest.fn(),
}));

import { WallRenderer } from '../WallRenderer';
import { MIN_ENTITY_CONTRAST } from '../../../config/contrast-adaptation';
import { clearPrintColorPolicy, setPrintColorPolicy } from '../../../config/print-color-policy';
import { RENDER_LINE_WIDTHS } from '../../../config/text-rendering-config';
import { useBimRenderSettingsStore } from '../../../state/bim-render-settings-store';
import { createExterior25EpsDna } from '../../types/wall-dna-types';
import { MATERIAL_HATCH_STROKE_RGBA } from '../shared/material-hatch-paint';
import { ENGINEER_PDF, FLOOR_PX, PLOT_STYLES, isGrey, isOpaque, onPaper, publicImage } from './print-pass-policies';
import type { Painted, PaintedStroke } from './recording-canvas';
import { paintedBy, sampleWall, type SampleWall } from './structural-samples';

const THIN = RENDER_LINE_WIDTHS.THIN;
const AXIS_DASH = [6, 4];

const paint = (wall: SampleWall): Painted => paintedBy((ctx) => new WallRenderer(ctx), wall);
const isAxis = (s: PaintedStroke): boolean => s.dash.length > 0;
/** Οι γραμμές στρώσεων: ό,τι χαράχτηκε μετά το περίγραμμα και δεν είναι ο άξονας. */
const layerLines = (painted: Painted): PaintedStroke[] => painted.strokes.slice(1).filter((s) => !isAxis(s));

const plain = sampleWall();
/** Τοίχος δύο στρώσεων (μόνωση + τούβλο) ⇒ μία εσωτερική γραμμή στρώσης. */
const layered = sampleWall({ dna: createExterior25EpsDna() });

afterEach(() => {
  clearPrintColorPolicy();
  useBimRenderSettingsStore.getState().setPlanLinesOnly(false);
});

describe('WallRenderer — ο άξονας (ADR-909 Γ2.5 Η2)', () => {
  it('Τ1 οθόνη όπως πριν: ένας άξονας, 1 px διακεκομμένος', () => {
    const axis = paint(plain).strokes.filter(isAxis);
    expect(axis).toHaveLength(1);
    expect(axis[0].width).toBe(THIN);
    expect(axis[0].dash).toStrictEqual(AXIS_DASH);
  });

  it.each(PLOT_STYLES)('Τ2 🔴 δημόσια κάτοψη «%s»: ο άξονας δεν τυπώνεται — και μόνο αυτός λείπει', (style) => {
    const onScreen = paint(plain).strokes;
    setPrintColorPolicy(publicImage(style));
    const onPaperStrokes = paint(plain).strokes;
    expect(onPaperStrokes.filter(isAxis)).toHaveLength(0);
    expect(onPaperStrokes).toHaveLength(onScreen.length - 1);
    for (const s of onPaperStrokes) expect(s.width).toBeGreaterThanOrEqual(FLOOR_PX);
  });

  it('Τ5 PDF του μηχανικού: ούτε εκεί τυπώνεται ο άξονας (δηλωμένη συνέπεια)', () => {
    setPrintColorPolicy(ENGINEER_PDF);
    const strokes = paint(plain).strokes;
    expect(strokes.length).toBeGreaterThan(0);
    expect(strokes.filter(isAxis)).toHaveLength(0);
  });
});

describe('WallRenderer — γραμμές στρώσεων (ADR-909 Γ2.5 Η4)', () => {
  it('Τ3 οθόνη όπως πριν: αχνές, 1 px', () => {
    expect(layerLines(paint(layered))).toStrictEqual([{ ink: MATERIAL_HATCH_STROKE_RGBA, width: THIN, dash: [] }]);
  });

  it.each(PLOT_STYLES)('Τ3 🔴 δημόσια κάτοψη «%s»: πλήρες μελάνι ≥ 3:1, στο δάπεδο πάχους', (style) => {
    setPrintColorPolicy(publicImage(style));
    const lines = layerLines(paint(layered));
    expect(lines).toHaveLength(1);
    expect(isOpaque(lines[0].ink)).toBe(true);
    expect(onPaper(lines[0].ink)).toBeGreaterThanOrEqual(MIN_ENTITY_CONTRAST);
    expect(lines[0].width).toBe(FLOOR_PX);
  });

  it('Τ5 PDF του μηχανικού: πλήρες μαύρο, χωρίς δάπεδο 4 px', () => {
    setPrintColorPolicy(ENGINEER_PDF);
    expect(layerLines(paint(layered))).toStrictEqual([{ ink: '#000000', width: THIN, dash: [] }]);
  });
});

describe('WallRenderer — όψη «Μόνο κάτοψη» (ADR-909 Γ2.5 Η4)', () => {
  beforeEach(() => useBimRenderSettingsStore.getState().setPlanLinesOnly(true));

  it('Τ4 οθόνη όπως πριν: καθαρές γραμμές 1 px, χωρίς γέμισμα', () => {
    const { fills, strokes } = paint(plain);
    expect(fills).toHaveLength(0);
    expect(strokes.length).toBeGreaterThan(0);
    expect(strokes[strokes.length - 1].width).toBe(THIN);
  });

  it.each(PLOT_STYLES)('Τ4 🔴 δημόσια κάτοψη «%s»: στο δάπεδο πάχους, ≥ 3:1', (style) => {
    setPrintColorPolicy(publicImage(style));
    const { strokes } = paint(plain);
    expect(strokes.length).toBeGreaterThan(0);
    for (const s of strokes) {
      expect(s.width).toBeGreaterThanOrEqual(FLOOR_PX);
      expect(onPaper(s.ink)).toBeGreaterThanOrEqual(MIN_ENTITY_CONTRAST);
      if (style !== 'colour') expect(isGrey(s.ink)).toBe(true);
    }
    expect(strokes[strokes.length - 1].width).toBe(FLOOR_PX);
  });

  it('Τ5 PDF του μηχανικού: το πάχος του όπως το ζήτησε', () => {
    setPrintColorPolicy(ENGINEER_PDF);
    const { strokes } = paint(plain);
    expect(strokes[strokes.length - 1]).toStrictEqual({ ink: '#000000', width: THIN, dash: [] });
  });
});
