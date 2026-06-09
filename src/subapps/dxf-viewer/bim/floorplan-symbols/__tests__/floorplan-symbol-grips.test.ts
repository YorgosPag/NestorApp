/**
 * ADR-415 — floorplan-symbol parametric grip tests.
 *
 * Pure math (no React/DOM): grip emission + drag transforms. `sceneUnits: 'mm'`
 * → scale s = 1, so mm scalars equal world units. 1:1 mirror of
 * `furniture-grips.test`; all geometry/rotation math lives in the shared
 * centred-box SSoT — these tests pin the floorplan-symbol adapter's role/field
 * mapping (FULL SSOT verification).
 */

import { getFloorplanSymbolGrips, applyFloorplanSymbolGripDrag } from '../floorplan-symbol-grips';
import type { FloorplanSymbolEntity, FloorplanSymbolParams } from '../../types/floorplan-symbol-types';

const baseParams: FloorplanSymbolParams = {
  category: 'sanitary',
  kind: 'wc',
  assetId: 'wc_standard_01',
  position: { x: 1000, y: 2000, z: 0 },
  rotationDeg: 0,
  widthMm: 600,
  depthMm: 600,
  sceneUnits: 'mm',
};

function entityWith(overrides: Partial<FloorplanSymbolParams> = {}): FloorplanSymbolEntity {
  return {
    id: 'fps-1',
    type: 'floorplan-symbol',
    params: { ...baseParams, ...overrides },
  } as unknown as FloorplanSymbolEntity;
}

describe('getFloorplanSymbolGrips', () => {
  // ADR-363 Φ1G.5 Slice 2: move grip no longer emitted → 5 grips (rotation + 4 corners)
  it('emits 5 grips in stable order (rotation, 4 corners)', () => {
    const grips = getFloorplanSymbolGrips(entityWith());
    expect(grips.map((g) => g.floorplanSymbolGripKind)).toEqual([
      'floorplan-symbol-rotation',
      'floorplan-symbol-corner-ne',
      'floorplan-symbol-corner-nw',
      'floorplan-symbol-corner-sw',
      'floorplan-symbol-corner-se',
    ]);
  });

  // ADR-363 Φ1G.5 Slice 2: move grip gone — byKind lookup still works for remaining grips
  it('places corners at ±half-extents (rotation 0)', () => {
    const grips = getFloorplanSymbolGrips(entityWith());
    const byKind = Object.fromEntries(grips.map((g) => [g.floorplanSymbolGripKind, g.position]));
    expect(byKind['floorplan-symbol-move']).toBeUndefined();
    expect(byKind['floorplan-symbol-corner-ne']).toEqual({ x: 1300, y: 2300 });
    expect(byKind['floorplan-symbol-corner-nw']).toEqual({ x: 700, y: 2300 });
    expect(byKind['floorplan-symbol-corner-sw']).toEqual({ x: 700, y: 1700 });
    expect(byKind['floorplan-symbol-corner-se']).toEqual({ x: 1300, y: 1700 });
  });
});

describe('applyFloorplanSymbolGripDrag', () => {
  it('move grip translates the position by the delta', () => {
    const out = applyFloorplanSymbolGripDrag('floorplan-symbol-move', {
      originalParams: baseParams,
      delta: { x: 50, y: -30 },
    });
    expect(out.position).toEqual({ x: 1050, y: 1970, z: 0 });
    expect(out.widthMm).toBe(600);
  });

  it('corner drag resizes width/depth and re-centres (opposite corner anchored)', () => {
    const out = applyFloorplanSymbolGripDrag('floorplan-symbol-corner-ne', {
      originalParams: baseParams,
      delta: { x: 200, y: 200 },
    });
    expect(out.widthMm).toBeCloseTo(800);
    expect(out.depthMm).toBeCloseTo(800);
  });

  it('zero delta returns the original params referentially unchanged', () => {
    const out = applyFloorplanSymbolGripDrag('floorplan-symbol-move', {
      originalParams: baseParams,
      delta: { x: 0, y: 0 },
    });
    expect(out).toBe(baseParams);
  });
});
