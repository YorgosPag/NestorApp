/**
 * ADR-574 Σ2b — `buildSlabOpeningPreviewEntity` tests.
 *
 * Ο preview-tolerant builder μοιράζεται το ΙΔΙΟ geometry/validator SSoT με το
 * strict commit builder (`buildSlabOpeningEntity`), αλλά παρακάμπτει ΜΟΝΟ το
 * `outlineOutsideSlab` hard-reject ώστε το placement ghost να μην εξαφανίζεται
 * στις άκρες της πλάκας (big-player: Revit δείχνει opening + warning).
 *
 * Coverage:
 *   - εντός slab → { entity, isOutsideSlab: false }
 *   - εκτός slab (ορθογώνιο διασχίζει άκρη) → { entity, isOutsideSlab: true }
 *   - genuine malformed geometry (self-intersecting) → null
 */

import {
  buildDefaultSlabOpeningParams,
  buildSlabOpeningPreviewEntity,
} from '../slab-opening-completion';
import type { SlabOpeningParams } from '../../../bim/types/slab-opening-types';
import type { SlabEntity, SlabParams } from '../../../bim/types/slab-types';
import { computeSlabGeometry } from '../../../bim/geometry/slab-geometry';

function makeSlab(): SlabEntity {
  // 10m × 10m floor slab (mm world coords).
  const params: SlabParams = {
    kind: 'floor',
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

describe('buildSlabOpeningPreviewEntity (ADR-574 Σ2b)', () => {
  it('εντός slab → επιστρέφει entity με isOutsideSlab=false (πλήρες WYSIWYG)', () => {
    const slab = makeSlab();
    // Default shaft 1500mm centered στο (5000,5000) → 4250..5750, εντός 10×10m slab.
    const params = buildDefaultSlabOpeningParams(slab, { x: 5000, y: 5000 }, { kind: 'shaft' }, 'mm');
    const built = buildSlabOpeningPreviewEntity(params, slab, '0');
    expect(built).not.toBeNull();
    expect(built?.isOutsideSlab).toBe(false);
    expect(built?.entity.type).toBe('slab-opening');
    expect(built?.entity.geometry.polygon.vertices.length).toBeGreaterThanOrEqual(3);
  });

  it('εκτός slab (διασχίζει άκρη) → entity παρών + isOutsideSlab=true (🔴 schematic, ΟΧΙ κενό)', () => {
    const slab = makeSlab();
    // Center (9900,9900): default 1500 → 9150..10650, x-max 10650 > 10000 → εκτός.
    const params = buildDefaultSlabOpeningParams(slab, { x: 9900, y: 9900 }, { kind: 'shaft' }, 'mm');
    const built = buildSlabOpeningPreviewEntity(params, slab, '0');
    expect(built).not.toBeNull();
    expect(built?.isOutsideSlab).toBe(true);
    // ΚΡΙΣΙΜΟ: το ghost ΔΕΝ εξαφανίζεται — υπάρχει entity προς 🔴 ζωγράφισμα.
    expect(built?.entity.type).toBe('slab-opening');
  });

  it('genuine malformed geometry (self-intersecting) → null (τίποτα valid προς ζωγράφισμα)', () => {
    const slab = makeSlab();
    // Bowtie outline — self-intersecting hard error, ΟΧΙ preview-tolerable.
    const params: SlabOpeningParams = {
      kind: 'shaft',
      slabId: 'slab_test',
      sceneUnits: 'mm',
      outline: {
        vertices: [
          { x: 4000, y: 4000, z: 0 },
          { x: 5000, y: 5000, z: 0 },
          { x: 5000, y: 4000, z: 0 },
          { x: 4000, y: 5000, z: 0 },
        ],
      },
    } as SlabOpeningParams;
    const built = buildSlabOpeningPreviewEntity(params, slab, '0');
    expect(built).toBeNull();
  });
});
