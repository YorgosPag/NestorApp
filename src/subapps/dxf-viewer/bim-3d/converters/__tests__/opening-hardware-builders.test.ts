/**
 * ADR-672 §8 Α — `buildHardwareSpecs` operable-hardware (χειρολαβή) coverage.
 *
 * Locks: doors/operable windows get handle boxes (all on the hardware material);
 * `handing` drives the latch side; fixed/bay/overhead/revolving get NONE;
 * degenerate leaves get NONE.
 */

import * as THREE from 'three';
import { buildHardwareSpecs } from '../opening-hardware-builders';
import type { LeafDims } from '../opening-mesh-builders';
import type { OpeningEntity, OpeningKind, OpeningHanding } from '../../../bim/types/opening-types';

const HW = new THREE.MeshStandardMaterial();

/** Door-sized clear leaf in metres (900×2100, 250 wall, 50 frame). */
const DOOR_DIMS: LeafDims = { widthW: 0.9, heightM: 2.1, sillM: 0, thicknessW: 0.25, frameW: 0.05 };
/** Window-sized leaf with a sill (900×1200 @ 900 sill). */
const WIN_DIMS: LeafDims = { widthW: 0.9, heightM: 1.2, sillM: 0.9, thicknessW: 0.2, frameW: 0.05 };

function op(kind: OpeningKind, handing?: OpeningHanding): OpeningEntity {
  return {
    id: 'op', type: 'opening', kind, layerId: '0',
    params: { kind, wallId: 'w', offsetFromStart: 0, width: 900, height: 2100, sillHeight: 0, handing },
  } as unknown as OpeningEntity;
}

describe('buildHardwareSpecs — presence + material', () => {
  it('single swing door → handle boxes, all on the hardware material', () => {
    const specs = buildHardwareSpecs(op('door'), DOOR_DIMS, HW);
    expect(specs.length).toBeGreaterThan(0);
    expect(specs.every((s) => s.mat === HW)).toBe(true);
  });

  it('double-door → handles on BOTH sides of the central meeting stile', () => {
    const specs = buildHardwareSpecs(op('double-door'), { ...DOOR_DIMS, widthW: 1.4 }, HW);
    expect(specs.some((s) => s.cx > 0)).toBe(true);
    expect(specs.some((s) => s.cx < 0)).toBe(true);
  });

  it('sliding door → a pull bar on both faces (±Z)', () => {
    const specs = buildHardwareSpecs(op('sliding-door'), DOOR_DIMS, HW);
    expect(specs.some((s) => s.cz > 0)).toBe(true);
    expect(specs.some((s) => s.cz < 0)).toBe(true);
  });

  it('bifold door → knob on both faces', () => {
    const specs = buildHardwareSpecs(op('bifold-door'), { ...DOOR_DIMS, widthW: 1.8 }, HW);
    expect(specs.length).toBe(2);
    expect(specs.every((s) => s.mat === HW)).toBe(true);
  });
});

describe('buildHardwareSpecs — handing drives the latch side', () => {
  it("default/left handing → latch on +X, right handing → latch on -X", () => {
    const maxCx = (h?: OpeningHanding): number =>
      Math.max(...buildHardwareSpecs(op('door', h), DOOR_DIMS, HW).map((s) => s.cx));
    const minCx = (h?: OpeningHanding): number =>
      Math.min(...buildHardwareSpecs(op('door', h), DOOR_DIMS, HW).map((s) => s.cx));
    expect(maxCx('left')).toBeGreaterThan(0);
    expect(maxCx(undefined)).toBeGreaterThan(0);
    expect(minCx('right')).toBeLessThan(0);
  });
});

describe('buildHardwareSpecs — operable windows', () => {
  it('awning window → interior-face handle (all cz < 0)', () => {
    const specs = buildHardwareSpecs(op('awning-window'), WIN_DIMS, HW);
    expect(specs.length).toBeGreaterThan(0);
    expect(specs.every((s) => s.cz < 0)).toBe(true);
  });

  it('fixed + bay windows → NO hardware (no operable sash)', () => {
    expect(buildHardwareSpecs(op('fixed'), WIN_DIMS, HW)).toHaveLength(0);
    expect(buildHardwareSpecs(op('bay-window'), WIN_DIMS, HW)).toHaveLength(0);
  });
});

describe('buildHardwareSpecs — no user-operable handle', () => {
  it('overhead + revolving doors → NO hardware', () => {
    expect(buildHardwareSpecs(op('overhead-door'), DOOR_DIMS, HW)).toHaveLength(0);
    expect(buildHardwareSpecs(op('revolving-door'), DOOR_DIMS, HW)).toHaveLength(0);
  });

  it('degenerate leaf (frame ≥ half width) → NO hardware', () => {
    const specs = buildHardwareSpecs(op('door'), { ...DOOR_DIMS, frameW: 0.6 }, HW);
    expect(specs).toHaveLength(0);
  });
});
