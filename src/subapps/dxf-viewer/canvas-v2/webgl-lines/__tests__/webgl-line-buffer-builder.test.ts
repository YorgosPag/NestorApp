/**
 * ADR-639 Στάδιο 5 — buffer-builder structure & invariants.
 *
 * Segment counts (LINE→1, open poly(n)→n-1, closed→n), bucketing by (width,alpha),
 * DESC length sort, per-vertex LINEAR colour, ownedEntityIds membership, and the
 * MAX_BUCKETS backstop routing surplus back to Canvas2D. Style resolution and layer
 * skipping are injected → pure test, no store setup. N.17-safe (jest only).
 */

import * as THREE from 'three';
import { buildWebglLineBuffers, MAX_BUCKETS } from '../webgl-line-buffer-builder';
import type { DxfEntityUnion } from '../../dxf-canvas/dxf-types';
import type { ResolvedRenderStyle } from '../../dxf-canvas/dxf-renderer-style-resolve';

const SOLID = (colorHex: string, lineWidthPx = 1, alpha = 1): ResolvedRenderStyle => ({
  colorHex, lineWidthPx, alpha, dashMm: [],
});
const NEVER_SKIP = () => false;

function line(id: string, x1: number, y1: number, x2: number, y2: number): DxfEntityUnion {
  return { id, type: 'line', visible: true, start: { x: x1, y: y1 }, end: { x: x2, y: y2 } } as DxfEntityUnion;
}
function poly(id: string, pts: Array<[number, number]>, closed = false): DxfEntityUnion {
  return {
    id, type: 'polyline', visible: true, closed,
    vertices: pts.map(([x, y]) => ({ x, y })),
  } as DxfEntityUnion;
}

describe('buildWebglLineBuffers — segment counts', () => {
  it('LINE → 1 segment', () => {
    const r = buildWebglLineBuffers([line('l', 0, 0, 3, 4)], () => SOLID('#ffffff'), NEVER_SKIP);
    expect(r.buckets).toHaveLength(1);
    expect(r.buckets[0].worldLengths).toHaveLength(1);
    expect(r.buckets[0].worldLengths[0]).toBeCloseTo(5, 6); // 3-4-5
    expect(r.buckets[0].positions).toHaveLength(6);
  });

  it('open polyline(n) → n-1 segments', () => {
    const r = buildWebglLineBuffers([poly('p', [[0, 0], [1, 0], [2, 0], [3, 0]])], () => SOLID('#ffffff'), NEVER_SKIP);
    expect(r.buckets[0].worldLengths).toHaveLength(3);
  });

  it('closed polyline(n) → n segments', () => {
    const r = buildWebglLineBuffers([poly('p', [[0, 0], [1, 0], [1, 1]], true)], () => SOLID('#ffffff'), NEVER_SKIP);
    expect(r.buckets[0].worldLengths).toHaveLength(3);
  });
});

describe('buildWebglLineBuffers — bucketing & sort', () => {
  it('groups by (width, alpha) and separates distinct widths', () => {
    const r = buildWebglLineBuffers(
      [line('a', 0, 0, 1, 0), line('b', 0, 0, 2, 0)],
      (e) => SOLID('#ffffff', e.id === 'a' ? 1 : 3),
      NEVER_SKIP,
    );
    expect(r.buckets).toHaveLength(2);
  });

  it('sorts segments DESC by world length within a bucket', () => {
    const r = buildWebglLineBuffers(
      [line('short', 0, 0, 1, 0), line('long', 0, 0, 10, 0), line('mid', 0, 0, 5, 0)],
      () => SOLID('#ffffff'),
      NEVER_SKIP,
    );
    const w = r.buckets[0].worldLengths;
    expect([...w]).toEqual([...w].slice().sort((a, b) => b - a));
    expect(w[0]).toBeCloseTo(10, 6);
  });
});

describe('buildWebglLineBuffers — colour (linear)', () => {
  it('uploads LINEAR rgb for the entity hex (both endpoints share it)', () => {
    const r = buildWebglLineBuffers([line('l', 0, 0, 1, 0)], () => SOLID('#808080'), NEVER_SKIP);
    const expected = new THREE.Color().setStyle('#808080'); // linear under ColorManagement
    const c = r.buckets[0].colors;
    expect(c[0]).toBeCloseTo(expected.r, 5);
    expect(c[1]).toBeCloseTo(expected.g, 5);
    expect(c[2]).toBeCloseTo(expected.b, 5);
    expect(c[3]).toBeCloseTo(expected.r, 5); // second vertex, same colour
  });
});

describe('buildWebglLineBuffers — ownership & filtering', () => {
  it('excludes layer-skipped entities from buckets and ownedEntityIds', () => {
    const r = buildWebglLineBuffers(
      [line('keep', 0, 0, 1, 0), line('frozen', 0, 0, 1, 0)],
      () => SOLID('#ffffff'),
      (e) => e.id === 'frozen',
    );
    expect(r.ownedEntityIds.has('keep')).toBe(true);
    expect(r.ownedEntityIds.has('frozen')).toBe(false);
  });

  it('excludes dashed (resolved) lines', () => {
    const r = buildWebglLineBuffers(
      [line('dashed', 0, 0, 1, 0)],
      () => ({ colorHex: '#fff', lineWidthPx: 1, alpha: 1, dashMm: [5, -5] }),
      NEVER_SKIP,
    );
    expect(r.buckets).toHaveLength(0);
    expect(r.ownedEntityIds.size).toBe(0);
  });
});

describe('buildWebglLineBuffers — MAX_BUCKETS backstop', () => {
  it('keeps the most-populated buckets and routes surplus back to Canvas2D', () => {
    // MAX_BUCKETS+4 distinct widths; the widest-index buckets get FEWER segments so
    // they are the ones dropped. Each "bucket i" gets (i+1) single-segment entities.
    const entities: DxfEntityUnion[] = [];
    const widthOf: Record<string, number> = {};
    const total = MAX_BUCKETS + 4;
    for (let i = 0; i < total; i++) {
      const count = i + 1; // bucket i has i+1 segments → higher i = more populated
      for (let j = 0; j < count; j++) {
        const id = `w${i}_s${j}`;
        entities.push(line(id, 0, 0, 1, 0));
        widthOf[id] = i + 1; // distinct width per bucket
      }
    }
    const r = buildWebglLineBuffers(entities, (e) => SOLID('#fff', widthOf[e.id]), NEVER_SKIP);
    expect(r.buckets).toHaveLength(MAX_BUCKETS);
    // The 4 least-populated buckets (i = 0..3) are dropped → their entities not owned.
    expect(r.ownedEntityIds.has('w0_s0')).toBe(false);
    expect(r.ownedEntityIds.has('w3_s0')).toBe(false);
    // A high-population bucket survives.
    expect(r.ownedEntityIds.has(`w${total - 1}_s0`)).toBe(true);
  });
});
