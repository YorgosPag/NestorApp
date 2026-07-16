/**
 * Tests for `WALL_PREVIEW_SPEC` / `SLAB_PREVIEW_SPEC` (ADR-412/ADR-414).
 *
 * WHY THIS FILE EXISTS: the wall and slab previews were byte-level twins and were
 * merged onto the shared `BandStackPreviewRenderer` (ADR-584). Everything that
 * survived as genuinely per-entity behaviour now lives in these two specs — so
 * the spec IS the risk surface of that refactor. The renderer around them is a
 * WebGL shell that jsdom cannot instantiate; the specs are pure data + pure
 * functions and are fully testable, which is exactly why the delta was pushed
 * into them.
 *
 * The expected values below are transcribed from the pre-refactor renderers, so
 * this file is a regression lock on the merge, not a restatement of the code.
 */

import * as THREE from 'three';
import { WALL_PREVIEW_SPEC } from '../WallTypePreviewRenderer';
import { SLAB_PREVIEW_SPEC } from '../SlabTypePreviewRenderer';
import type { WallDna, WallDnaLayer } from '../../../bim/types/wall-dna-types';
import { computeTotalThickness } from '../../../bim/types/wall-dna-types';
import type { SlabDna } from '../../../bim/types/slab-dna-types';
import { computeSlabTotalThickness } from '../../../bim/types/slab-dna-types';
import type { SlabDnaLayer } from '../../../bim/types/slab-dna-types';

// ─── fixtures ────────────────────────────────────────────────────────────────

const WALL_LAYERS: readonly WallDnaLayer[] = [
  { id: 'out', name: 'Plaster', thickness: 20, materialId: 'mat-plaster-ext', side: 'exterior' },
  { id: 'core', name: 'Concrete', thickness: 210, materialId: 'mat-concrete-c25', side: 'core' },
  { id: 'in', name: 'Plaster', thickness: 20, materialId: 'mat-plaster-int', side: 'interior' },
];
const WALL_DNA: WallDna = { layers: WALL_LAYERS, totalThickness: computeTotalThickness(WALL_LAYERS) };

const SLAB_LAYERS: readonly SlabDnaLayer[] = [
  { id: 'top', name: 'Tile', thickness: 10, materialId: 'mat-tile', zone: 'top' },
  { id: 'core', name: 'RC', thickness: 200, materialId: 'mat-concrete-c25', zone: 'core' },
  { id: 'bot', name: 'Plaster', thickness: 15, materialId: 'mat-plaster-int', zone: 'bottom' },
];
const SLAB_DNA: SlabDna = {
  layers: SLAB_LAYERS,
  totalThickness: computeSlabTotalThickness(SLAB_LAYERS),
};

/**
 * Which axis the layers stack along = the ONLY half-extent that moves with the
 * DNA thickness. Detected by differencing rather than by looking for a magic
 * value: the wall's stub is 1.0 m tall, so `halfExtents(1)` is `[0.6, 0.5, 0.5]`
 * and "the axis whose extent is 0.5" is ambiguous.
 */
function stackAxisOf(spec: {
  halfExtents(totalM: number): readonly [number, number, number];
}): number {
  const thin = spec.halfExtents(0.2);
  const thick = spec.halfExtents(0.6);
  return thin.findIndex((v, i) => Math.abs(v - thick[i]) > 1e-9);
}

// ─── the contract both specs share ───────────────────────────────────────────

describe('band-stack preview specs — shared contract', () => {
  const CASES = [
    { name: 'wall', spec: WALL_PREVIEW_SPEC, dna: WALL_DNA, layerIds: ['out', 'core', 'in'] },
    { name: 'slab', spec: SLAB_PREVIEW_SPEC, dna: SLAB_DNA, layerIds: ['top', 'core', 'bot'] },
  ] as const;

  describe.each(CASES)('$name', ({ spec, dna, layerIds }) => {
    it('exposes a unit view direction', () => {
      // The fit solve builds its right/up basis from this and never normalizes
      // it — a non-unit vector would silently scale the camera distance.
      expect(spec.viewDir.length()).toBeCloseTo(1, 6);
    });

    it('builds one band per layer, preserving identity', () => {
      const bands = spec.buildBands(dna);
      expect(bands.map((b) => b.layerId)).toEqual(layerIds);
      expect(bands.every((b) => b.materialId.length > 0)).toBe(true);
    });

    it('gives every band a positive, finite box', () => {
      for (const band of spec.buildBands(dna)) {
        const { size, position } = spec.boxOf(band);
        expect(size.every((s) => Number.isFinite(s) && s > 0)).toBe(true);
        expect(position.every((p) => Number.isFinite(p))).toBe(true);
      }
    });

    it('derives half-extents that are half the stated total on the stack axis', () => {
      const extents = spec.halfExtents(0.4);
      expect(extents).toHaveLength(3);
      expect(extents.some((e) => Math.abs(e - 0.2) < 1e-9)).toBe(true);
    });

    it('has a positive fallback thickness for the DNA-less first frame', () => {
      expect(spec.fallbackThicknessM).toBeGreaterThan(0);
    });

    it('stacks the bands so their boxes sum to the DNA total thickness', () => {
      // The band stack must physically add up to the DNA — this is what makes the
      // preview an honest section rather than a decorative one.
      const bands = spec.buildBands(dna);
      const stackAxis = stackAxisOf(spec);
      const sum = bands.reduce((acc, b) => acc + spec.boxOf(b).size[stackAxis], 0);
      expect(sum).toBeCloseTo(dna.totalThickness / 1000, 6);
    });

    it('centres the stack on the origin along the stack axis', () => {
      const bands = spec.buildBands(dna);
      const stackAxis = stackAxisOf(spec);
      const boxes = bands.map((b) => spec.boxOf(b));
      const lo = Math.min(...boxes.map((x) => x.position[stackAxis] - x.size[stackAxis] / 2));
      const hi = Math.max(...boxes.map((x) => x.position[stackAxis] + x.size[stackAxis] / 2));
      expect(lo + hi).toBeCloseTo(0, 6);
    });
  });
});

// ─── the per-entity deltas, transcribed from the pre-refactor renderers ──────

describe('WALL_PREVIEW_SPEC — wall-specific values', () => {
  it('keeps the documented 3/4 view direction (ADR-414 changelog (b))', () => {
    expect(WALL_PREVIEW_SPEC.viewDir).toEqual(new THREE.Vector3(1.5, 1.05, 0.85).normalize());
  });

  it('uses a 1.2 × 1.0 m stub, thickness on Z', () => {
    expect(WALL_PREVIEW_SPEC.halfExtents(0.25)).toEqual([0.6, 0.5, 0.125]);
  });

  it('falls back to 250 mm before any DNA arrives', () => {
    expect(WALL_PREVIEW_SPEC.fallbackThicknessM).toBe(0.25);
  });

  it('lays each band across the full slice, stacking along Z', () => {
    const band = { layerId: 'core', materialId: 'm', depthM: 0.21, centerZM: 0.02 };
    expect(WALL_PREVIEW_SPEC.boxOf(band)).toEqual({
      size: [1.2, 1.0, 0.21], // length, height, the layer's own depth
      position: [0, 0, 0.02], // offset ONLY along the thickness axis
    });
  });
});

describe('SLAB_PREVIEW_SPEC — slab-specific values', () => {
  it('keeps the documented 3/4 view direction', () => {
    expect(SLAB_PREVIEW_SPEC.viewDir).toEqual(new THREE.Vector3(0.85, 1.05, 1.5).normalize());
  });

  it('uses a 1.4 × 0.9 m patch, thickness on Y', () => {
    expect(SLAB_PREVIEW_SPEC.halfExtents(0.285)).toEqual([0.7, 0.1425, 0.45]);
  });

  it('falls back to 200 mm before any DNA arrives', () => {
    expect(SLAB_PREVIEW_SPEC.fallbackThicknessM).toBe(0.2);
  });

  it('lays each band across the full footprint, stacking along Y', () => {
    const band = { layerId: 'core', materialId: 'm', heightM: 0.2, centerYM: -0.03 };
    expect(SLAB_PREVIEW_SPEC.boxOf(band)).toEqual({
      size: [1.4, 0.2, 0.9], // width, the layer's own height, depth
      position: [0, -0.03, 0], // offset ONLY along the thickness axis
    });
  });
});

describe('the two specs are genuinely different (the merge did not collapse them)', () => {
  it('stacks on different axes', () => {
    // Wall = Z (index 2), slab = Y (index 1). If a future edit made these equal,
    // one of the two previews would be silently rendering the other's section.
    const wallAxis = stackAxisOf(WALL_PREVIEW_SPEC);
    const slabAxis = stackAxisOf(SLAB_PREVIEW_SPEC);
    expect(wallAxis).toBe(2);
    expect(slabAxis).toBe(1);
    expect(wallAxis).not.toBe(slabAxis);
  });

  it('looks from different directions', () => {
    expect(WALL_PREVIEW_SPEC.viewDir.equals(SLAB_PREVIEW_SPEC.viewDir)).toBe(false);
  });
});
