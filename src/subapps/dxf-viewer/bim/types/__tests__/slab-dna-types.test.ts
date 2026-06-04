/**
 * Slab DNA build-up — per-kind defaults + multi-layer guard + schema round-trip.
 *
 * jest globals (ΟΧΙ vitest).
 */

import {
  computeSlabTotalThickness,
  getDefaultSlabBuildupForKind,
  isMultiLayerSlab,
} from '../slab-dna-types';
import { SlabDnaSchema, SlabParamsSchema } from '../slab.schemas';
import type { SlabKind } from '../slab-types';

const ALL_KINDS: readonly SlabKind[] = [
  'floor',
  'roof',
  'ground',
  'foundation',
  'ceiling',
];

const EXPECTED_TOTAL_MM: Readonly<Record<SlabKind, number>> = {
  floor: 285,
  roof: 434,
  ground: 405,
  foundation: 500,
  ceiling: 142.5,
};

describe('getDefaultSlabBuildupForKind', () => {
  it.each(ALL_KINDS)('produces a self-consistent build-up for %s', (kind) => {
    const dna = getDefaultSlabBuildupForKind(kind);
    expect(dna.layers.length).toBeGreaterThan(1);
    expect(dna.totalThickness).toBe(computeSlabTotalThickness(dna.layers));
    expect(dna.totalThickness).toBeCloseTo(EXPECTED_TOTAL_MM[kind], 6);
  });

  it.each(ALL_KINDS)('always includes a structural core layer for %s', (kind) => {
    const dna = getDefaultSlabBuildupForKind(kind);
    // ceiling is the only non-structural kind (suspended) — core = air/plenum
    if (kind === 'ceiling') return;
    const core = dna.layers.find((l) => l.zone === 'core');
    expect(core).toBeDefined();
    expect(core?.materialId).toBe('mat-concrete');
  });

  it('gives a top-down order: first layer is a top/finish zone for floor', () => {
    const floor = getDefaultSlabBuildupForKind('floor');
    expect(floor.layers[0].zone).toBe('top');
    expect(floor.layers[floor.layers.length - 1].zone).toBe('bottom');
  });

  it('foundation bears on soil → no soffit, just core + blinding', () => {
    const f = getDefaultSlabBuildupForKind('foundation');
    expect(f.layers.every((l) => l.materialId === 'mat-concrete')).toBe(true);
    expect(f.layers.some((l) => l.zone === 'core')).toBe(true);
  });

  it('uses stable, unique layer ids', () => {
    for (const kind of ALL_KINDS) {
      const ids = getDefaultSlabBuildupForKind(kind).layers.map((l) => l.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });
});

describe('isMultiLayerSlab', () => {
  it('is true for every per-kind default', () => {
    for (const kind of ALL_KINDS) {
      expect(isMultiLayerSlab(getDefaultSlabBuildupForKind(kind))).toBe(true);
    }
  });

  it('is false for undefined and single-layer build-ups', () => {
    expect(isMultiLayerSlab(undefined)).toBe(false);
    expect(
      isMultiLayerSlab({
        layers: [{ id: 'x', name: 'X', thickness: 200, materialId: 'mat-concrete', zone: 'core' }],
        totalThickness: 200,
      }),
    ).toBe(false);
  });
});

describe('Slab DNA schema round-trip', () => {
  it('parses every per-kind default build-up', () => {
    for (const kind of ALL_KINDS) {
      expect(() => SlabDnaSchema.parse(getDefaultSlabBuildupForKind(kind))).not.toThrow();
    }
  });

  it('accepts SlabParams whose thickness == dna.totalThickness', () => {
    const dna = getDefaultSlabBuildupForKind('floor');
    const params = {
      kind: 'floor' as const,
      outline: { vertices: [{ x: 0, y: 0 }, { x: 1000, y: 0 }, { x: 1000, y: 1000 }] },
      levelElevation: 0,
      thickness: dna.totalThickness,
      geometryType: 'box' as const,
      dna,
    };
    expect(() => SlabParamsSchema.parse(params)).not.toThrow();
  });

  it('rejects SlabParams whose thickness disagrees with dna.totalThickness', () => {
    const dna = getDefaultSlabBuildupForKind('floor');
    const params = {
      kind: 'floor' as const,
      outline: { vertices: [{ x: 0, y: 0 }, { x: 1000, y: 0 }, { x: 1000, y: 1000 }] },
      levelElevation: 0,
      thickness: dna.totalThickness + 50, // mismatch
      geometryType: 'box' as const,
      dna,
    };
    expect(() => SlabParamsSchema.parse(params)).toThrow();
  });
});
