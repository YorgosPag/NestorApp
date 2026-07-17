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

// ─── 2026-07-18 3D follow-up: backplate + neck + lock + spindle + hinges ──────
describe('buildHardwareSpecs — espagnolette assembly (ADR-672 §8 3D follow-up)', () => {
  // DOOR_DIMS: innerW = 0.9 - 2·0.05 = 0.8 → edge ±0.4; leaf depth = 0.25·0.35.
  const LEAF_DEPTH = 0.25 * 0.35;
  const HINGE_EDGE = -0.4; // default handing → latch +X, hinges on -X edge.

  it('door → a vertical backplate ~110mm tall bridging to the lever (neck)', () => {
    const specs = buildHardwareSpecs(op('door'), DOOR_DIMS, HW);
    // Backplate: the tall vertical plate.
    expect(specs.some((s) => Math.abs(s.sy - 0.11) < 1e-6)).toBe(true);
    // Neck: a square stub whose depth equals the lever stand-off (55mm).
    expect(specs.some((s) => Math.abs(s.sz - 0.055) < 1e-6 && Math.abs(s.sx - 0.02) < 1e-6)).toBe(true);
  });

  it('door → a through spindle spanning both faces (sz > leaf depth)', () => {
    const specs = buildHardwareSpecs(op('door'), DOOR_DIMS, HW);
    expect(specs.some((s) => s.sz > LEAF_DEPTH + 0.05)).toBe(true);
  });

  it('door → exactly 3 hinge barrels on the hinge-side edge, centred in depth', () => {
    const specs = buildHardwareSpecs(op('door'), DOOR_DIMS, HW);
    const hinges = specs.filter(
      (s) => Math.abs(s.cx - HINGE_EDGE) < 1e-6 && Math.abs(s.cz) < 1e-6,
    );
    expect(hinges).toHaveLength(3);
  });

  it('door → a lock cylinder below the lever on the latch side', () => {
    const specs = buildHardwareSpecs(op('door'), DOOR_DIMS, HW);
    // Handle sits at ~1.05m; the lock body/keyway drop below it on the +X (latch) side.
    expect(specs.some((s) => s.cx > 0 && s.cy < 1.02)).toBe(true);
  });

  it('casement window (hinged) → 2 edge hinges; sliding-window (no hinge in catalog) → none', () => {
    const casement = buildHardwareSpecs(op('window'), WIN_DIMS, HW);
    expect(casement.filter((s) => Math.abs(s.cz) < 1e-6)).toHaveLength(2);
    const slider = buildHardwareSpecs(op('sliding-window'), WIN_DIMS, HW);
    expect(slider.filter((s) => Math.abs(s.cz) < 1e-6)).toHaveLength(0);
  });
});
