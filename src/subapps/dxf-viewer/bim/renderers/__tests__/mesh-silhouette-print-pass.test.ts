/**
 * ADR-909 Γ2.2 — τα σχήματα 3Δ (έπιπλο · εισαγόμενο πλέγμα · είδος υγιεινής) ρωτούν την πολιτική εκτύπωσης.
 *
 * Πριν: πέντε ωμά `ctx.strokeStyle = palette.…` / `ctx.lineWidth = …` στο `mesh-silhouette-draw`. Στη δημόσια
 * κάτοψη «Ασπρόμαυρο» το έπιπλο έβγαινε `#8b5e34` 2 px (πύλη pixels: `K1/K2/K3:*:furniture`, `imported-mesh`).
 *
 * Σ1 οθόνη όπως πριν · Σ2 «Ασπρόμαυρο» ⇒ μαύρο και στο δάπεδο πάχους · Σ3 «Έγχρωμο» ⇒ πλήρες χρώμα, η
 * διαφάνεια της ακμής πέφτει · Σ4 «Γκρι» ⇒ άχρωμο και ≥ 3:1 · Σ5 το PDF του μηχανικού δεν παίρνει δάπεδο πάχους.
 */

import { BIM_CATEGORY_LINE_COLORS } from '../../../config/bim-object-styles';
import { MIN_ENTITY_CONTRAST } from '../../../config/contrast-adaptation';
import { clearPrintColorPolicy, setPrintColorPolicy } from '../../../config/print-color-policy';
import {
  drawMeshContourFill,
  drawMeshFallbackBox,
  drawMeshSilhouette,
  drawMeshSlotSilhouettes,
  type MeshSilhouettePalette,
} from '../mesh-silhouette-draw';
import { ENGINEER_PDF, FLOOR_PX, isGrey, onPaper, publicImage } from './print-pass-policies';

const STROKE = BIM_CATEGORY_LINE_COLORS.furniture;
const EDGE = 'rgba(139, 94, 52, 0.55)';
const PALETTE: MeshSilhouettePalette = { stroke: STROKE, fill: 'rgba(180, 130, 80, 0.16)', edge: EDGE };
const SQUARE = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }];
const SEGMENT = [{ x1: 0, y1: 0, x2: 1, y2: 1 }];
const TRANSFORM = { position: { x: 0, y: 0 }, rotationDeg: 0, sceneUnits: 'mm' as const };
const WIDTH = 2;

interface Stroke { readonly ink: string; readonly width: number }

/** Πλαστός καμβάς: θυμάται μελάνι και πάχος **τη στιγμή** κάθε `stroke()`. */
function recordingContext(): { ctx: CanvasRenderingContext2D; strokes: Stroke[] } {
  const strokes: Stroke[] = [];
  const ctx = {
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 0,
    beginPath: jest.fn(),
    moveTo: jest.fn(),
    lineTo: jest.fn(),
    closePath: jest.fn(),
    fill: jest.fn(),
    setLineDash: jest.fn(),
    stroke(this: { strokeStyle: string; lineWidth: number }) {
      strokes.push({ ink: this.strokeStyle, width: this.lineWidth });
    },
  };
  return { ctx: ctx as unknown as CanvasRenderingContext2D, strokes };
}

const identity = (p: { x: number; y: number }): { x: number; y: number } => p;

/** Και οι τέσσερις δρόμοι του αρχείου, στη σειρά: σιλουέτα+ακμές · περίγραμμα γεμίσματος+ακμές · poché · κουτί. */
function drawAllPaths(): Stroke[] {
  const { ctx, strokes } = recordingContext();
  const common = { ctx, worldToScreen: identity, transform: TRANSFORM, lineWidth: WIDTH };
  drawMeshSilhouette({ ...common, silhouette: SQUARE, edges: SEGMENT, palette: PALETTE });
  drawMeshContourFill({ ...common, contours: [SQUARE], edges: SEGMENT, palette: PALETTE });
  drawMeshSlotSilhouettes({ ...common, slots: [{ contours: [SQUARE], palette: PALETTE }] });
  drawMeshFallbackBox({ ctx, worldToScreen: identity, vertices: SQUARE, palette: PALETTE, lineWidth: WIDTH, loading: false });
  return strokes;
}

afterEach(clearPrintColorPolicy);

describe('mesh-silhouette-draw — print pass (ADR-909 Γ2.2)', () => {
  it('Σ1 οθόνη όπως πριν: παλέτα και πάχος αυτούσια, η ακμή ημιδιαφανής και 1 px λεπτότερη', () => {
    expect(drawAllPaths()).toStrictEqual([
      { ink: STROKE, width: WIDTH }, { ink: EDGE, width: WIDTH - 1 },
      { ink: STROKE, width: WIDTH }, { ink: EDGE, width: WIDTH - 1 },
      { ink: STROKE, width: WIDTH },
      { ink: STROKE, width: WIDTH },
    ]);
  });

  it('Σ2 🔴 «Ασπρόμαυρο»: κάθε γραμμή μαύρη και στο δάπεδο πάχους — καμία ωμή', () => {
    setPrintColorPolicy(publicImage('monochrome'));
    const strokes = drawAllPaths();
    expect(strokes).toHaveLength(6);
    for (const s of strokes) expect(s).toStrictEqual({ ink: '#000000', width: FLOOR_PX });
  });

  it('Σ3 «Έγχρωμο»: το πλήρες χρώμα της κατηγορίας — η διαφάνεια της ακμής πέφτει (AutoCAD / Revit)', () => {
    setPrintColorPolicy(publicImage('colour'));
    for (const s of drawAllPaths()) {
      expect(s.ink).toBe(STROKE);
      expect(onPaper(s.ink)).toBeGreaterThanOrEqual(MIN_ENTITY_CONTRAST);
    }
  });

  it('Σ4 «Γκρι»: άχρωμο και ≥ 3:1 προς το χαρτί', () => {
    setPrintColorPolicy(publicImage('grayscale'));
    for (const s of drawAllPaths()) {
      expect(isGrey(s.ink)).toBe(true);
      expect(onPaper(s.ink)).toBeGreaterThanOrEqual(MIN_ENTITY_CONTRAST);
    }
  });

  it('Σ5 PDF του μηχανικού (χωρίς δάπεδα): άχρωμο σε «Ασπρόμαυρο», το πάχος του όπως το ζήτησε', () => {
    setPrintColorPolicy(ENGINEER_PDF);
    const strokes = drawAllPaths();
    for (const s of strokes) expect(s.ink).toBe('#000000');
    expect(strokes.map((s) => s.width)).toStrictEqual([WIDTH, WIDTH - 1, WIDTH, WIDTH - 1, WIDTH, WIDTH]);
  });
});
