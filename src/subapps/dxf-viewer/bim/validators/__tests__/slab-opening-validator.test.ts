/**
 * ADR-363 Phase 3.7 — `validateSlabOpeningParams` tests.
 *
 * Coverage:
 *   - Hard errors: missing slabId, too few vertices, self-intersecting,
 *     zero-area (below min threshold), outline outside host slab.
 *   - Code violations: min dimension below threshold per kind.
 *   - hostSlab = null path runs intrinsic checks μόνο (no outsideSlab).
 */

import { validateSlabOpeningParams } from '../slab-opening-validator';
import type { SlabOpeningParams } from '../../types/slab-opening-types';
import type { SlabEntity } from '../../types/slab-types';
import { computeSlabGeometry } from '../../geometry/slab-geometry';

function makeOpening(
  verts: ReadonlyArray<{ x: number; y: number }>,
  overrides?: Partial<SlabOpeningParams>,
): SlabOpeningParams {
  return {
    kind: 'shaft',
    slabId: 'slab_test',
    outline: { vertices: verts.map((v) => ({ x: v.x, y: v.y, z: 0 })) },
    ...overrides,
  } as SlabParams;
}

function makeSlab(): SlabEntity {
  // 10m × 10m floor slab (mm world coords).
  const params = {
    kind: 'floor' as const,
    outline: {
      vertices: [
        { x: 0, y: 0, z: 0 },
        { x: 10000, y: 0, z: 0 },
        { x: 10000, y: 10000, z: 0 },
        { x: 0, y: 10000, z: 0 },
      ],
    },
    levelElevation: 0,
    thickness: 200,
    geometryType: 'box',
  };
  return {
    id: 'slab_test',
    type: 'slab',
    kind: 'floor',
    layerId: '0',
    params,
    geometry: computeSlabGeometry(params),
    validation: { hasCodeViolations: false, violationKeys: [], lastValidatedAt: null },
    visible: true,
  } as unknown as SlabEntity;
}

describe('validateSlabOpeningParams — hard errors', () => {
  it('flags missingHostSlab when slabId is empty', () => {
    const params = makeOpening(
      [{ x: 0, y: 0 }, { x: 1500, y: 0 }, { x: 1500, y: 1500 }, { x: 0, y: 1500 }],
      { slabId: '' },
    );
    const r = validateSlabOpeningParams(params, null);
    expect(r.hardErrors).toContain('slabOpening.validation.hardErrors.missingHostSlab');
  });

  it('flags tooFewVertices όταν vertices < 3', () => {
    const params = makeOpening([{ x: 0, y: 0 }, { x: 1500, y: 0 }]);
    const r = validateSlabOpeningParams(params, null);
    expect(r.hardErrors).toContain('slabOpening.validation.hardErrors.tooFewVertices');
  });

  it('flags selfIntersecting για bowtie polygon', () => {
    // Bowtie: edges (0→1) και (2→3) τέμνονται.
    const params = makeOpening([
      { x: 0, y: 0 },
      { x: 1000, y: 1000 },
      { x: 1000, y: 0 },
      { x: 0, y: 1000 },
    ]);
    const r = validateSlabOpeningParams(params, null);
    expect(r.hardErrors).toContain('slabOpening.validation.hardErrors.selfIntersecting');
  });

  it('flags zeroArea όταν area κάτω από min threshold', () => {
    // 50mm × 50mm = 2500 mm² < 10_000 mm² threshold.
    const params = makeOpening([
      { x: 0, y: 0 }, { x: 50, y: 0 }, { x: 50, y: 50 }, { x: 0, y: 50 },
    ]);
    const r = validateSlabOpeningParams(params, null);
    expect(r.hardErrors).toContain('slabOpening.validation.hardErrors.zeroArea');
  });

  it('flags outlineOutsideSlab όταν cutout βγαίνει εκτός slab', () => {
    const slab = makeSlab();
    // Opening μερικώς έξω από το 10×10m slab.
    const params = makeOpening([
      { x: 9000, y: 9000 }, { x: 11000, y: 9000 },
      { x: 11000, y: 11000 }, { x: 9000, y: 11000 },
    ]);
    const r = validateSlabOpeningParams(params, slab);
    expect(r.hardErrors).toContain('slabOpening.validation.hardErrors.outlineOutsideSlab');
  });

  it('passes when opening σωστά μέσα στο slab', () => {
    const slab = makeSlab();
    const params = makeOpening([
      { x: 2000, y: 2000 }, { x: 3500, y: 2000 },
      { x: 3500, y: 3500 }, { x: 2000, y: 3500 },
    ]);
    const r = validateSlabOpeningParams(params, slab);
    expect(r.hardErrors).toHaveLength(0);
  });
});

describe('validateSlabOpeningParams — code violations', () => {
  it('flags tooSmallForKind όταν min dimension < threshold ανά kind (shaft 1100mm)', () => {
    // 900mm × 900mm shaft → κάτω από 1100 threshold.
    const params = makeOpening([
      { x: 0, y: 0 }, { x: 900, y: 0 }, { x: 900, y: 900 }, { x: 0, y: 900 },
    ], { kind: 'shaft' });
    const r = validateSlabOpeningParams(params, null);
    expect(r.codeViolations).toContain('slabOpening.validation.codeViolations.tooSmallForKind');
  });

  it('does not flag tooSmallForKind όταν min dimension >= threshold', () => {
    const params = makeOpening([
      { x: 0, y: 0 }, { x: 1500, y: 0 }, { x: 1500, y: 1500 }, { x: 0, y: 1500 },
    ], { kind: 'shaft' });
    const r = validateSlabOpeningParams(params, null);
    expect(r.codeViolations).not.toContain('slabOpening.validation.codeViolations.tooSmallForKind');
  });
});

describe('validateSlabOpeningParams — soft-orphan path', () => {
  it('hostSlab=null skips outside-slab check + still validates intrinsic', () => {
    const params = makeOpening([
      { x: 99999, y: 99999 }, { x: 101499, y: 99999 },
      { x: 101499, y: 101499 }, { x: 99999, y: 101499 },
    ]);
    const r = validateSlabOpeningParams(params, null);
    expect(r.hardErrors).not.toContain('slabOpening.validation.hardErrors.outlineOutsideSlab');
    expect(r.hardErrors).toHaveLength(0);
  });
});
