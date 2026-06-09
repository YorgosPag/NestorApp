/**
 * ADR-408 Φ3 — Electrical panel parametric grip tests (wall-parity).
 *
 * Pure math (no React/DOM): grip emission + drag transforms. `sceneUnits: 'mm'`
 * → scale factor s = 1, so mm scalars equal world units and the geometry is
 * exact to assert. 1:1 mirror of `mep-fixture-grips` coverage minus circular.
 */

import { getElectricalPanelGrips, applyElectricalPanelGripDrag } from '../electrical-panel-grips';
import type { ElectricalPanelEntity, ElectricalPanelParams } from '../../types/electrical-panel-types';
import { MIN_PANEL_DIMENSION_MM } from '../../types/electrical-panel-types';

const baseParams: ElectricalPanelParams = {
  kind: 'distribution-board',
  shape: 'rectangular',
  position: { x: 1000, y: 2000, z: 0 },
  rotation: 0,
  width: 600,
  length: 600,
  bodyHeightMm: 700,
  mountingElevationMm: 1500,
  sceneUnits: 'mm',
};

function entityWith(overrides: Partial<ElectricalPanelParams> = {}): ElectricalPanelEntity {
  return {
    id: 'panel-1',
    type: 'electrical-panel',
    params: { ...baseParams, ...overrides },
  } as unknown as ElectricalPanelEntity;
}

describe('getElectricalPanelGrips', () => {
  // ADR-363 Φ1G.5 Slice 2: move grip removed from emission → 5 grips, rotation first.
  it('emits 5 grips for a rectangular panel in stable order', () => {
    const grips = getElectricalPanelGrips(entityWith());
    expect(grips.map((g) => g.electricalPanelGripKind)).toEqual([
      'electrical-panel-rotation',
      'electrical-panel-corner-ne',
      'electrical-panel-corner-nw',
      'electrical-panel-corner-sw',
      'electrical-panel-corner-se',
    ]);
  });

  // ADR-363 Φ1G.5 Slice 2: move grip no longer emitted — assert only corners.
  it('places corners at ±half-extents (rotation 0)', () => {
    const grips = getElectricalPanelGrips(entityWith());
    const byKind = Object.fromEntries(grips.map((g) => [g.electricalPanelGripKind, g.position]));
    expect(byKind['electrical-panel-corner-ne']).toEqual({ x: 1300, y: 2300 });
    expect(byKind['electrical-panel-corner-nw']).toEqual({ x: 700, y: 2300 });
    expect(byKind['electrical-panel-corner-sw']).toEqual({ x: 700, y: 1700 });
    expect(byKind['electrical-panel-corner-se']).toEqual({ x: 1300, y: 1700 });
  });

  // ADR-363 Φ1G.5 Slice 2: rotation is now array index 0 (move grip removed); gripIndex field stays 1.
  it('places the rotation handle beyond the +Y edge (length/2 + offset)', () => {
    const [rotation] = getElectricalPanelGrips(entityWith());
    // length/2 (300) + ROTATION_HANDLE_OFFSET_MM (200) = 500 above centre.
    expect(rotation.position).toEqual({ x: 1000, y: 2500 });
  });
});

describe('applyElectricalPanelGripDrag', () => {
  it('returns originalParams referentially for a zero delta', () => {
    const p = baseParams;
    expect(applyElectricalPanelGripDrag('electrical-panel-corner-ne', { originalParams: p, delta: { x: 0, y: 0 } })).toBe(p);
  });

  it('move translates position by the delta', () => {
    const next = applyElectricalPanelGripDrag('electrical-panel-move', { originalParams: baseParams, delta: { x: 10, y: 20 } });
    expect(next.position).toEqual({ x: 1010, y: 2020, z: 0 });
  });

  it('corner-ne grows width toward the cursor, pins the opposite (SW) corner, re-centres', () => {
    const next = applyElectricalPanelGripDrag('electrical-panel-corner-ne', { originalParams: baseParams, delta: { x: 100, y: 0 } });
    expect(next.width).toBe(700);
    expect(next.length).toBe(600);
    // SW corner stays at (700, 1700) → new centre = (700 + 700/2, 1700 + 600/2).
    expect(next.position).toEqual({ x: 1050, y: 2000, z: 0 });
  });

  it('ORTHO constrains a diagonal corner drag to the dominant local axis', () => {
    const next = applyElectricalPanelGripDrag('electrical-panel-corner-ne', {
      originalParams: baseParams,
      delta: { x: 200, y: 100 },
      ortho: true,
    });
    expect(next.width).toBe(800);  // dominant +X applied
    expect(next.length).toBe(600); // +Y suppressed by ortho
  });

  it('clamps width to the minimum dimension', () => {
    const next = applyElectricalPanelGripDrag('electrical-panel-corner-ne', { originalParams: baseParams, delta: { x: -590, y: 0 } });
    expect(next.width).toBe(MIN_PANEL_DIMENSION_MM);
  });

  it('rotation handle drag sweeps the rotation angle about the centre', () => {
    // Handle starts at (1000, 2500); move it to (500, 2000) → vector (0,500)→(-500,0) = +90°.
    const next = applyElectricalPanelGripDrag('electrical-panel-rotation', { originalParams: baseParams, delta: { x: -500, y: -500 } });
    expect(next.rotation).toBeCloseTo(90, 5);
  });
});

// ADR-397 / ADR-408 — 6-click ROTATE→Reference about an arbitrary picked centre.
describe('applyElectricalPanelGripDrag — pivot rotate (hot-grip 6-click)', () => {
  // Panel at (1000, 0); pivot at origin. Reference dir = +X, alignment dir = +Y
  // → swept 90° CCW. delta = alignDir − refDir; currentPos = pivot + alignDir.
  const pivotParams: ElectricalPanelParams = { ...baseParams, position: { x: 1000, y: 0, z: 0 }, rotation: 0 };

  it('orbits position about the pivot AND sweeps rotation by the same angle', () => {
    const next = applyElectricalPanelGripDrag('electrical-panel-rotation', {
      originalParams: pivotParams,
      delta: { x: -100, y: 100 },        // alignDir(0,100) − refDir(100,0)
      currentPos: { x: 0, y: 100 },      // pivot + alignDir
      pivot: { x: 0, y: 0 },
    });
    expect(next.rotation).toBeCloseTo(90, 5);
    expect(next.position.x).toBeCloseTo(0, 5);
    expect(next.position.y).toBeCloseTo(1000, 5);
    expect(next.position.z).toBe(0);
  });

  it('falls back to own-centre rotation when no pivot is supplied (legacy drag)', () => {
    // Position must NOT orbit (no pivot) — only the angle changes (handle-relative).
    const next = applyElectricalPanelGripDrag('electrical-panel-rotation', {
      originalParams: pivotParams,
      delta: { x: -500, y: -500 },
    });
    expect(next.position).toEqual({ x: 1000, y: 0, z: 0 });
    expect(next.rotation).toBeCloseTo(90, 5);
  });
});
