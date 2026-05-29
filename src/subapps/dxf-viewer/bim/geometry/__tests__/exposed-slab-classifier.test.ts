/**
 * ADR-396 Phase P3 — exposed-slab-classifier unit tests (Z2 / Z3 / interior).
 *
 * Uses non-storey-linked slabs (no `storeyId`/`floorId` match) so the classifier
 * resolves position from `params.levelElevation` (mm) directly — the pure path,
 * independent of `getEntityAbsoluteElevation`.
 */

import {
  classifyExposedSlab,
  filterExposedSlabs,
  type SlabForZoneClassification,
} from '../exposed-slab-classifier';
import type { StoreyRef } from '../../utils/bim-floor-utils';

function slab(levelElevationMm: number, thickness = 200): SlabForZoneClassification {
  return { params: { levelElevation: levelElevationMm, thickness } };
}

/** StoreyRef list with elevations in METRES (classifier converts ×1000). */
function floorsAt(...elevationsM: number[]): StoreyRef[] {
  return elevationsM.map((e, i) => ({ id: `f${i}`, elevation: e }));
}

describe('classifyExposedSlab', () => {
  it('returns Z3 for the topmost slab (no storey above → roof)', () => {
    expect(classifyExposedSlab(slab(6000), floorsAt(0, 3, 6))).toBe('Z3');
  });

  it('returns null for an interior slab (storey both above and below)', () => {
    expect(classifyExposedSlab(slab(3000), floorsAt(0, 3, 6))).toBeNull();
  });

  it('returns Z2 for a pilotis soffit (storey above but none below)', () => {
    expect(classifyExposedSlab(slab(3000), floorsAt(3, 6))).toBe('Z2');
  });

  it('prefers Z3 when a slab has neither storey above nor below', () => {
    expect(classifyExposedSlab(slab(1000), floorsAt(1))).toBe('Z3');
  });

  it('treats a storey within ELEV_SNAP of the top face as not above (roof)', () => {
    // Highest storey coincides with the slab top → no storey strictly above.
    expect(classifyExposedSlab(slab(3000), floorsAt(0, 3))).toBe('Z3');
  });
});

describe('filterExposedSlabs', () => {
  it('keeps only exposed slabs, tagging each with its zone', () => {
    const roof = slab(6000);
    const interior = slab(3000);
    const result = filterExposedSlabs([roof, interior], floorsAt(0, 3, 6));
    expect(result).toEqual([{ slab: roof, zone: 'Z3' }]);
  });

  it('returns an empty array when no slab is exposed', () => {
    // Only an interior slab in a 3-storey stack.
    const result = filterExposedSlabs([slab(3000)], floorsAt(0, 3, 6));
    expect(result).toEqual([]);
  });
});
