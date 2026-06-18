/**
 * ADR-483 (T3-UI / Slice 4b+) — member-diagram-draw enrichment tests.
 *
 * Επαληθεύει με mock 2D context: (α) σημεία μηδενισμού (M=0) = ένας κύκλος ανά αλλαγή
 * προσήμου (κανένας σε σταθερό πρόσημο)· (β) end values = δύο pills (M_i/M_j).
 */

import { drawInflectionMarkers, drawDiagramEndValues } from '../member-diagram-draw';
import type { MemberDiagramPath, DiagramSample } from '../member-diagram-geometry';

interface Rec {
  arcs: number;
  texts: number;
}

function makeCtx(): { ctx: CanvasRenderingContext2D; rec: Rec } {
  const rec: Rec = { arcs: 0, texts: 0 };
  const ctx = {
    save() {}, restore() {}, beginPath() {}, closePath() {},
    moveTo() {}, lineTo() {}, quadraticCurveTo() {}, arcTo() {},
    arc() { rec.arcs++; },
    setLineDash() {}, stroke() {}, fill() {},
    fillText() { rec.texts++; },
    measureText() { return { width: 30 }; },
    set fillStyle(_v: string) {}, set strokeStyle(_v: string) {},
    set lineWidth(_v: number) {}, set font(_v: string) {},
    set textAlign(_v: string) {}, set textBaseline(_v: string) {},
  } as unknown as CanvasRenderingContext2D;
  return { ctx, rec };
}

const SI = { x: 0, y: 0 };
const SJ = { x: 400, y: 0 };

function path(values: number[]): MemberDiagramPath {
  const samples: DiagramSample[] = values.map((value, i) => ({ f: i / (values.length - 1), value }));
  let extremum = samples[0]!;
  for (const s of samples) if (Math.abs(s.value) >= Math.abs(extremum.value)) extremum = s;
  return { memberId: 'b1', iCanvas: { x: 0, y: 0 }, jCanvas: { x: 4, y: 0 }, samples, extremum };
}

describe('drawInflectionMarkers — σημεία M=0', () => {
  it('μία αλλαγή προσήμου ⇒ ένας κύκλος', () => {
    const { ctx, rec } = makeCtx();
    drawInflectionMarkers(ctx, SI, SJ, path([-20, 50, -20])); // − → + → −  = 2 crossings
    expect(rec.arcs).toBe(2);
  });

  it('σταθερό πρόσημο (όλο sagging) ⇒ κανένας κύκλος', () => {
    const { ctx, rec } = makeCtx();
    drawInflectionMarkers(ctx, SI, SJ, path([10, 50, 10]));
    expect(rec.arcs).toBe(0);
  });
});

describe('drawDiagramEndValues', () => {
  it('σχεδιάζει δύο pills (M_i + M_j)', () => {
    const { ctx, rec } = makeCtx();
    drawDiagramEndValues(ctx, SI, SJ, path([-18, 50, -16]), 0.1, 'kNm');
    expect(rec.texts).toBe(2);
  });
});
