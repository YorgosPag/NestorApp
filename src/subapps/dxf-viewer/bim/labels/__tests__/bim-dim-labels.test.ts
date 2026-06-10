/**
 * ADR-363 / ADR-436 — bim-dim-labels SSoT tests.
 *
 * Covers `formatBimDimLabels` dispatch per BIM entity type (column delegation,
 * wall metres→mm regression guard, foundation pad/strip/tie-beam, beam profile
 * prefix, opening, `[]` for unsupported/degenerate), `foundationAxisLengthMm`,
 * and `drawDimPill` font + fillText behaviour on a mock canvas context.
 */

import {
  formatBimDimLabels,
  foundationAxisLengthMm,
  drawDimPill,
} from '../bim-dim-labels';
import { PILL_DIM_FONT } from '../../../rendering/utils/canvas-pill';
import type { Entity } from '../../../types/entities';

// Minimal entity factories — only the fields the formatters read. Cast through
// `unknown` (no `any`) since the formatters consume a small typed surface.
function ent(o: object): Entity {
  return o as unknown as Entity;
}

describe('formatBimDimLabels', () => {
  it('delegates columns to formatColumnDimLabels', () => {
    expect(formatBimDimLabels(ent({ type: 'column', params: { kind: 'rectangular', width: 400, depth: 400 } })))
      .toEqual(['w=400  d=400']);
    expect(formatBimDimLabels(ent({ type: 'column', params: { kind: 'circular', width: 500, depth: 500 } })))
      .toEqual(['Ø=500']);
  });

  it('formats a wall as L (mm) × t — geometry.length is metres', () => {
    expect(formatBimDimLabels(ent({ type: 'wall', params: { thickness: 200 }, geometry: { length: 3 } })))
      .toEqual(['L=3000  t=200']);
  });

  it('returns [] for a wall without geometry / zero length', () => {
    expect(formatBimDimLabels(ent({ type: 'wall', params: { thickness: 200 } }))).toEqual([]);
    expect(formatBimDimLabels(ent({ type: 'wall', params: { thickness: 200 }, geometry: { length: 0 } }))).toEqual([]);
  });

  it('formats a beam as w × d with optional profile prefix', () => {
    expect(formatBimDimLabels(ent({ type: 'beam', params: { width: 300, depth: 500 } })))
      .toEqual(['w=300  d=500']);
    expect(formatBimDimLabels(ent({ type: 'beam', params: { width: 300, depth: 500, profileDesignation: 'IPE-300' } })))
      .toEqual(['IPE-300', 'w=300  d=500']);
  });

  it('formats an opening as w × h', () => {
    expect(formatBimDimLabels(ent({ type: 'opening', params: { width: 900, height: 2100 } })))
      .toEqual(['w=900  h=2100']);
  });

  it('formats a pad foundation as w × l (+ optional catalogProfile)', () => {
    expect(formatBimDimLabels(ent({ type: 'foundation', params: { kind: 'pad', width: 1200, length: 1500 } })))
      .toEqual(['w=1200  l=1500']);
    expect(formatBimDimLabels(ent({ type: 'foundation', params: { kind: 'pad', width: 1200, length: 1500, catalogProfile: 'C25/30' } })))
      .toEqual(['C25/30', 'w=1200  l=1500']);
  });

  it('formats a strip/tie-beam foundation as axis-length × width (scene mm)', () => {
    expect(formatBimDimLabels(ent({
      type: 'foundation',
      params: { kind: 'strip', start: { x: 0, y: 0 }, end: { x: 2400, y: 0 }, width: 600, sceneUnits: 'mm' },
    }))).toEqual(['L=2400  w=600']);
    expect(formatBimDimLabels(ent({
      type: 'foundation',
      params: { kind: 'tie-beam', start: { x: 0, y: 0 }, end: { x: 0, y: 1800 }, width: 300, sceneUnits: 'mm' },
    }))).toEqual(['L=1800  w=300']);
  });

  it('returns [] for unsupported entity types', () => {
    expect(formatBimDimLabels(ent({ type: 'line' }))).toEqual([]);
    expect(formatBimDimLabels(ent({ type: 'mep-fixture', params: {} }))).toEqual([]);
  });
});

describe('foundationAxisLengthMm', () => {
  it('returns Euclidean axis length in mm for strip/tie-beam', () => {
    expect(foundationAxisLengthMm({ kind: 'strip', start: { x: 0, y: 0 }, end: { x: 3000, y: 4000 }, width: 500, sceneUnits: 'mm' } as never))
      .toBe(5000);
  });
  it('returns 0 for pad', () => {
    expect(foundationAxisLengthMm({ kind: 'pad', width: 400, length: 400 } as never)).toBe(0);
  });
});

describe('drawDimPill', () => {
  function mockCtx(): CanvasRenderingContext2D & { fillTextCalls: string[]; fontSet: string } {
    const fillTextCalls: string[] = [];
    let fontSet = '';
    const ctx = {
      save() {}, restore() {},
      set font(v: string) { fontSet = v; },
      get font() { return fontSet; },
      measureText: (t: string) => ({ width: t.length * 6 }),
      beginPath() {}, moveTo() {}, lineTo() {}, quadraticCurveTo() {}, closePath() {}, fill() {},
      fillText(t: string) { fillTextCalls.push(t); },
      fillStyle: '', textBaseline: '', textAlign: '',
      get fillTextCalls() { return fillTextCalls; },
      get fontSet() { return fontSet; },
    };
    return ctx as unknown as CanvasRenderingContext2D & { fillTextCalls: string[]; fontSet: string };
  }

  it('uses PILL_DIM_FONT and draws one fillText per line', () => {
    const ctx = mockCtx();
    drawDimPill(ctx, ['IPE-300', 'w=300  d=500'], 100, 100);
    expect(ctx.fontSet).toBe(PILL_DIM_FONT);
    expect(ctx.fillTextCalls).toEqual(['IPE-300', 'w=300  d=500']);
  });

  it('no-ops on empty lines', () => {
    const ctx = mockCtx();
    drawDimPill(ctx, [], 0, 0);
    expect(ctx.fillTextCalls).toEqual([]);
  });
});
