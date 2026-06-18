/**
 * ADR-483 (T3-UI / Slice 4b) — member-load-arrows draw guard tests.
 *
 * Επαληθεύει τη συμπεριφορά του pure draw helper με mock 2D context: (α) no-op όταν
 * το φορτίο είναι ≤0 (αφόρτιστο δοκάρι) ή το μέλος εκφυλισμένο (μηδενικό μήκος)·
 * (β) σχεδιάζει βέλη + ετικέτα όταν υπάρχει θετικό w_Ed.
 */

import { drawMemberLoadArrows } from '../member-load-arrows';

interface MockCtx {
  strokes: number;
  fills: number;
  texts: number;
}

function makeCtx(): { ctx: CanvasRenderingContext2D; rec: MockCtx } {
  const rec: MockCtx = { strokes: 0, fills: 0, texts: 0 };
  const ctx = {
    save() {}, restore() {}, beginPath() {}, closePath() {},
    moveTo() {}, lineTo() {}, quadraticCurveTo() {}, arcTo() {},
    setLineDash() {},
    stroke() { rec.strokes++; },
    fill() { rec.fills++; },
    fillText() { rec.texts++; },
    measureText() { return { width: 40 }; },
    set fillStyle(_v: string) {}, set strokeStyle(_v: string) {},
    set lineWidth(_v: number) {}, set font(_v: string) {},
    set textAlign(_v: string) {}, set textBaseline(_v: string) {},
  } as unknown as CanvasRenderingContext2D;
  return { ctx, rec };
}

const SI = { x: 100, y: 100 };
const SJ = { x: 300, y: 100 };
const STYLE = { stroke: '#555', fill: '#555' };

describe('drawMemberLoadArrows', () => {
  it('no-op όταν w ≤ 0 (αφόρτιστο)', () => {
    const { ctx, rec } = makeCtx();
    drawMemberLoadArrows(ctx, SI, SJ, 0, 'kN/m', STYLE);
    expect(rec.strokes).toBe(0);
    expect(rec.fills).toBe(0);
  });

  it('no-op όταν το μέλος είναι σημείο (μηδενικό μήκος)', () => {
    const { ctx, rec } = makeCtx();
    drawMemberLoadArrows(ctx, SI, SI, 12, 'kN/m', STYLE);
    expect(rec.strokes).toBe(0);
  });

  it('σχεδιάζει βέλη (strokes) + ετικέτα (text+pill fill) όταν w > 0', () => {
    const { ctx, rec } = makeCtx();
    drawMemberLoadArrows(ctx, SI, SJ, 12.3, 'kN/m', STYLE);
    expect(rec.strokes).toBeGreaterThan(1); // tail-line + ≥2 arrow shafts
    expect(rec.fills).toBeGreaterThan(0);   // arrow heads + label pill
    expect(rec.texts).toBe(1);              // η ετικέτα «12,3 kN/m»
  });
});
