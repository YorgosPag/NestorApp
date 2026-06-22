/**
 * ADR-417 Φ-per-edge — tests for the per-edge roof slope ribbon resolver.
 *
 * Pure module (zero React/DOM) — exercised directly με `RoofParams` fixtures.
 * Καλύπτει: index clamping, outward-azimuth → compass (reuse SSoT), combobox
 * read state, και apply (select vs params· per-edge isolation· default seeding
 * μέσω roof-slope-units· immutability).
 */

import type { RoofParams } from '../../../../../bim/types/roof-types';
import {
  ROOF_EDGE_DEFINES_OFF,
  ROOF_EDGE_DEFINES_ON,
  applyRoofEdgeChange,
  clampEdgeIndex,
  resolveRoofEdgeComboboxState,
  roofEdgeCompass,
} from '../roof-edge-param';
import { edgeOutwardAzimuthDeg } from '../../../../../bim/geometry/shared/polygon-azimuth-utils';
import { ROOF_EDGE_KEYS } from '../roof-command-keys';

// ─── Fixture: CCW unit square (canvas units), 4 ακμές ─────────────────────────

function makeSquare(slopeUnit: RoofParams['slopeUnit'] = 'deg'): RoofParams {
  return {
    outline: {
      vertices: [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 100, y: 100 },
        { x: 0, y: 100 },
      ],
    },
    edges: [
      { definesSlope: true, slope: 30, overhangMm: 400 },
      { definesSlope: false, slope: 0, overhangMm: 0 },
      { definesSlope: true, slope: 30, overhangMm: 400 },
      { definesSlope: false, slope: 0, overhangMm: 0 },
    ],
    slopeUnit,
    basePivotZ: 3000,
    thickness: 200,
  };
}

describe('clampEdgeIndex', () => {
  it('clamps below/above range and floors', () => {
    expect(clampEdgeIndex(-1, 4)).toBe(0);
    expect(clampEdgeIndex(10, 4)).toBe(3);
    expect(clampEdgeIndex(2, 4)).toBe(2);
    expect(clampEdgeIndex(1.9, 4)).toBe(1);
    expect(clampEdgeIndex(0, 0)).toBe(0);
    expect(clampEdgeIndex(Number.NaN, 4)).toBe(0);
  });
});

describe('edgeOutwardAzimuthDeg (SSoT) / roofEdgeCompass', () => {
  it('gives 4 distinct compass labels ~90° apart for a square', () => {
    const sq = makeSquare();
    const verts = sq.outline.vertices;
    const compasses = [0, 1, 2, 3].map((i) => roofEdgeCompass(verts, i));
    expect(compasses.every((c) => c !== null)).toBe(true);
    expect(new Set(compasses).size).toBe(4);
  });

  it('consecutive edges differ by ~90° in outward azimuth', () => {
    const verts = makeSquare().outline.vertices;
    const az = [0, 1, 2, 3].map((i) => edgeOutwardAzimuthDeg(verts, i) ?? -1);
    for (let i = 0; i < 4; i++) {
      const diff = Math.abs(((az[(i + 1) % 4] - az[i] + 540) % 360) - 180);
      expect(Math.abs(diff - 90)).toBeLessThan(1);
    }
  });

  it('returns null for a degenerate (<3 vertices) polygon', () => {
    expect(roofEdgeCompass([{ x: 0, y: 0 }, { x: 1, y: 1 }], 0)).toBeNull();
  });
});

describe('resolveRoofEdgeComboboxState', () => {
  const sq = makeSquare();
  it('reads the selected index for the select key', () => {
    expect(resolveRoofEdgeComboboxState(ROOF_EDGE_KEYS.select, sq, 2)?.value).toBe('2');
  });
  it('reads definesSlope as on/off per edge', () => {
    expect(resolveRoofEdgeComboboxState(ROOF_EDGE_KEYS.defines, sq, 0)?.value).toBe(ROOF_EDGE_DEFINES_ON);
    expect(resolveRoofEdgeComboboxState(ROOF_EDGE_KEYS.defines, sq, 1)?.value).toBe(ROOF_EDGE_DEFINES_OFF);
  });
  it('reads slope + overhang of the selected edge', () => {
    expect(resolveRoofEdgeComboboxState(ROOF_EDGE_KEYS.slope, sq, 0)?.value).toBe('30');
    expect(resolveRoofEdgeComboboxState(ROOF_EDGE_KEYS.overhang, sq, 0)?.value).toBe('400');
  });
  it('returns null for a non-edge key', () => {
    expect(resolveRoofEdgeComboboxState('roof.params.basePivotZ', sq, 0)).toBeNull();
  });
});

describe('applyRoofEdgeChange — select', () => {
  it('returns a select result, clamped to range', () => {
    const sq = makeSquare();
    expect(applyRoofEdgeChange(ROOF_EDGE_KEYS.select, '3', sq, 0)).toEqual({ kind: 'select', edgeIndex: 3 });
    expect(applyRoofEdgeChange(ROOF_EDGE_KEYS.select, '99', sq, 0)).toEqual({ kind: 'select', edgeIndex: 3 });
  });
  it('returns null for a non-numeric edge value', () => {
    expect(applyRoofEdgeChange(ROOF_EDGE_KEYS.select, 'x', makeSquare(), 0)).toBeNull();
  });
});

describe('applyRoofEdgeChange — params (per-edge isolation + immutability)', () => {
  it('enabling defines on a flat edge seeds the default slope (deg)', () => {
    const sq = makeSquare('deg');
    const r = applyRoofEdgeChange(ROOF_EDGE_KEYS.defines, ROOF_EDGE_DEFINES_ON, sq, 1);
    expect(r?.kind).toBe('params');
    if (r?.kind !== 'params') throw new Error('expected params');
    expect(r.next.edges[1].definesSlope).toBe(true);
    expect(r.next.edges[1].slope).toBe(30); // DEFAULT_ROOF_SLOPE_DEG
    // other edges untouched
    expect(r.next.edges[0]).toEqual(sq.edges[0]);
    expect(r.next.edges[3]).toEqual(sq.edges[3]);
    // original fixture unmutated
    expect(sq.edges[1].definesSlope).toBe(false);
  });

  it('enabling defines seeds the default slope converted to percent (reuse roof-slope-units)', () => {
    const sq = makeSquare('percent');
    const r = applyRoofEdgeChange(ROOF_EDGE_KEYS.defines, ROOF_EDGE_DEFINES_ON, sq, 1);
    if (r?.kind !== 'params') throw new Error('expected params');
    // tan(30°)·100 ≈ 57.74 → round 58
    expect(r.next.edges[1].slope).toBe(58);
  });

  it('disabling defines keeps the stored slope', () => {
    const sq = makeSquare();
    const r = applyRoofEdgeChange(ROOF_EDGE_KEYS.defines, ROOF_EDGE_DEFINES_OFF, sq, 0);
    if (r?.kind !== 'params') throw new Error('expected params');
    expect(r.next.edges[0].definesSlope).toBe(false);
    expect(r.next.edges[0].slope).toBe(30);
  });

  it('sets slope on only the selected edge', () => {
    const sq = makeSquare();
    const r = applyRoofEdgeChange(ROOF_EDGE_KEYS.slope, '45', sq, 0);
    if (r?.kind !== 'params') throw new Error('expected params');
    expect(r.next.edges[0].slope).toBe(45);
    expect(r.next.edges[2].slope).toBe(30);
    expect(sq.edges[0].slope).toBe(30); // immutable
  });

  it('sets overhang on only the selected edge', () => {
    const sq = makeSquare();
    const r = applyRoofEdgeChange(ROOF_EDGE_KEYS.overhang, '600', sq, 2);
    if (r?.kind !== 'params') throw new Error('expected params');
    expect(r.next.edges[2].overhangMm).toBe(600);
    expect(r.next.edges[0].overhangMm).toBe(400);
  });

  it('rejects negative / non-numeric slope + overhang', () => {
    const sq = makeSquare();
    expect(applyRoofEdgeChange(ROOF_EDGE_KEYS.slope, '-5', sq, 0)).toBeNull();
    expect(applyRoofEdgeChange(ROOF_EDGE_KEYS.overhang, 'abc', sq, 0)).toBeNull();
  });
});
