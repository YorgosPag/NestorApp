/**
 * ADR-909 Γ2.5 (Η1) — `paintMaterialHatchSegments`: το ΕΝΑ σημείο γραμμοσκίασης υλικού (κολόνα / δοκός /
 * θεμέλιο / τοίχος) ρωτά την πολιτική εκτύπωσης και για το **μελάνι**, όχι μόνο για το πάχος.
 *
 * Πριν: `ctx.strokeStyle = 'rgba(0, 0, 0, 0.20)'` ωμό. Στη δημόσια κάτοψη η γραμμοσκίαση της κολόνας έβγαινε
 * `#cccccc`, 1,6:1 προς το χαρτί (πύλη pixels: `K2:*:column`).
 *
 * Υ1 οθόνη όπως πριν (αχνό `0.20`, 0,5 px) · Υ2 το στυλ του καλούντος περνά αυτούσιο στην οθόνη · Υ3 δημόσια
 * κάτοψη ⇒ πλήρες μελάνι ≥ 3:1 στο δάπεδο πάχους, άχρωμο στις άχρωμες στάθμες · Υ4 PDF του μηχανικού ⇒ πλήρες
 * μελάνι, χωρίς δάπεδο 4 px · Υ5 `save` / `restore` ζευγαρώνουν, και χωρίς γραμμές δεν αγγίζει τον καμβά.
 */

import { MIN_ENTITY_CONTRAST } from '../../../../config/contrast-adaptation';
import { clearPrintColorPolicy, setPrintColorPolicy } from '../../../../config/print-color-policy';
import type { HatchLineSegment } from '../../../geometry/shared/hatch-pattern-geometry';
import {
  MATERIAL_HATCH_LINE_WIDTH_PX,
  MATERIAL_HATCH_STROKE_RGBA,
  paintMaterialHatchSegments,
  type MaterialHatchPaintStyle,
} from '../material-hatch-paint';
import { ENGINEER_PDF, FLOOR_PX, PLOT_STYLES, isGrey, isOpaque, onPaper, publicImage } from '../../__tests__/print-pass-policies';
import { recordingContext, type Painted } from '../../__tests__/recording-canvas';

const SEGMENTS: readonly HatchLineSegment[] = [
  { start: { x: 0, y: 0 }, end: { x: 10, y: 10 } },
  { start: { x: 0, y: 5 }, end: { x: 5, y: 10 } },
];

function paint(style?: MaterialHatchPaintStyle, segments: readonly HatchLineSegment[] = SEGMENTS): Painted {
  const { ctx, painted } = recordingContext();
  paintMaterialHatchSegments(ctx, segments, (p) => p, style);
  return painted;
}

afterEach(clearPrintColorPolicy);

describe('paintMaterialHatchSegments (ADR-909 Γ2.5 Η1)', () => {
  it('Υ1 οθόνη όπως πριν: το αχνό μελάνι και το λεπτό πάχος αυτούσια', () => {
    expect(paint().strokes).toStrictEqual([
      { ink: MATERIAL_HATCH_STROKE_RGBA, width: MATERIAL_HATCH_LINE_WIDTH_PX, dash: [] },
    ]);
    expect(MATERIAL_HATCH_STROKE_RGBA).toBe('rgba(0, 0, 0, 0.20)');
  });

  it('Υ2 οθόνη: το στυλ του καλούντος (τοίχος — χρώμα V/G, παύλα) περνά αυτούσιο', () => {
    expect(paint({ strokeStyle: 'rgba(200, 30, 30, 0.5)', lineWidthPx: 1.5, dashPx: [4, 2] }).strokes).toStrictEqual([
      { ink: 'rgba(200, 30, 30, 0.5)', width: 1.5, dash: [4, 2] },
    ]);
  });

  it.each(PLOT_STYLES)('Υ3 🔴 δημόσια κάτοψη «%s»: πλήρες μελάνι ≥ 3:1, στο δάπεδο πάχους', (style) => {
    setPrintColorPolicy(publicImage(style));
    const [stroke] = paint().strokes;
    expect(isOpaque(stroke.ink)).toBe(true);
    expect(onPaper(stroke.ink)).toBeGreaterThanOrEqual(MIN_ENTITY_CONTRAST);
    expect(stroke.width).toBe(FLOOR_PX);
  });

  it('Υ3β «Ασπρόμαυρο» / «Γκρι»: και το χρωματιστό μελάνι του καλούντος βγαίνει άχρωμο', () => {
    for (const style of ['monochrome', 'grayscale'] as const) {
      setPrintColorPolicy(publicImage(style));
      const [stroke] = paint({ strokeStyle: 'rgba(200, 30, 30, 0.5)' }).strokes;
      expect(isGrey(stroke.ink)).toBe(true);
      expect(onPaper(stroke.ink)).toBeGreaterThanOrEqual(MIN_ENTITY_CONTRAST);
    }
  });

  it('Υ4 PDF του μηχανικού: πλήρες μαύρο, χωρίς δάπεδο 4 px', () => {
    setPrintColorPolicy(ENGINEER_PDF);
    expect(paint().strokes).toStrictEqual([{ ink: '#000000', width: 1, dash: [] }]);
  });

  it('Υ5 `save` / `restore` ζευγαρώνουν· χωρίς γραμμές δεν αγγίζει τον καμβά', () => {
    const drawn = paint();
    expect(drawn.saves).toBe(1);
    expect(drawn.restores).toBe(1);
    const empty = paint(undefined, []);
    expect(empty).toStrictEqual({ fills: [], texts: [], strokes: [], saves: 0, restores: 0 });
  });
});
