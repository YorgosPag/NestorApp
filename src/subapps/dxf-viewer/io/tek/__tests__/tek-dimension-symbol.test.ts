/**
 * ADR-531 Φ5b.1+ — tests για τη γεωμετρία συμβόλου διάστασης.
 */

import { buildDimensionSymbol } from '../tek-dimension-symbol';
import type { TekDimRecord, TekXMatrix } from '../tek-import-types';

const mat = (x20: number, x21: number): TekXMatrix =>
  ({ x00: 1, x01: 0, x10: 0, x11: 1, x20, x21 });

const dim = (refPoints: TekDimRecord['refPoints']): TekDimRecord => ({
  segs: [{
    end0: { x: -2.21, y: 6.98 }, end1: { x: -0.11, y: 6.98 },
    gap0: { x: -1.32, y: 6.98 }, gap1: { x: -1.0, y: 6.98 },
    text: '2.10', textMatrix: mat(-1.32, 6.39),
  }],
  color: '00FF00', textSizeM: 0.15875, endStyle: 8, refPoints,
});

describe('buildDimensionSymbol (ADR-531)', () => {
  it('γραμμή με κενό → 2 τμήματα + 2 πλάγιες παύλες + 1 κείμενο', () => {
    const g = buildDimensionSymbol(dim([]));
    expect(g.lines).toHaveLength(2);
    expect(g.ticks).toHaveLength(2);
    expect(g.texts).toHaveLength(1);
    expect(g.texts[0].text).toBe('2.10');
    expect(g.texts[0].heightM).toBeCloseTo(0.15875, 5);
  });

  it('τα σημεία αναφοράς που συμπίπτουν με τα άκρα ΔΕΝ προσθέτουν βοηθητικές', () => {
    const g = buildDimensionSymbol(dim([{ x: -2.21, y: 6.98 }, { x: -0.11, y: 6.98 }]));
    expect(g.lines).toHaveLength(2);
  });

  it('σημεία αναφοράς με offset → +2 βοηθητικές γραμμές', () => {
    const g = buildDimensionSymbol(dim([{ x: -2.21, y: 6.0 }, { x: -0.11, y: 6.0 }]));
    expect(g.lines).toHaveLength(4);
  });

  it('οι πλάγιες παύλες έχουν μη-μηδενικό μήκος (~textSize)', () => {
    const t = buildDimensionSymbol(dim([])).ticks[0];
    const len = Math.hypot(t.b.x - t.a.x, t.b.y - t.a.y);
    expect(len).toBeCloseTo(0.15875, 3);
  });
});
