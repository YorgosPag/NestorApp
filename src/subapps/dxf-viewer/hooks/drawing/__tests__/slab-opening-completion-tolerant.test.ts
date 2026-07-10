/**
 * ADR-632 Φ5 (edge-touching) — `buildSlabOpeningEntity` opt-in tolerance tests.
 *
 * Ο ΕΝΑΣ strict commit builder αποκτά opt-in `allowOutsideSlab` flag: για auto/
 * managed openings (stairwell) το outline που ακουμπά/φτάνει ως το χείλος του slab
 * commit-άρεται με **soft warning** αντί για σιωπηλό hard-reject (big-player: Revit
 * δείχνει opening + warning). Το default (χειροκίνητο) commit παραμένει strict.
 *
 * Coverage:
 *   - default (strict) + outline εκτός slab → ok:false (backward compat)
 *   - allowOutsideSlab + outline εκτός slab → ok:true + hasCodeViolations + soft key
 *   - allowOutsideSlab + genuine hard error (self-intersecting) → ok:false (block)
 *   - allowOutsideSlab + εντός slab → ok:true, καμία code violation (badge off)
 */

import {
  buildDefaultSlabOpeningParams,
  buildSlabOpeningEntity,
} from '../slab-opening-completion';
import type { SlabOpeningParams } from '../../../bim/types/slab-opening-types';
import type { SlabEntity, SlabParams } from '../../../bim/types/slab-types';
import { computeSlabGeometry } from '../../../bim/geometry/slab-geometry';

const OUTLINE_OUTSIDE_SLAB_KEY = 'slabOpening.validation.hardErrors.outlineOutsideSlab';
const OUTLINE_AT_SLAB_EDGE_WARNING_KEY = 'slabOpening.validation.codeViolations.outlineAtSlabEdge';

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

/** Rectangle που διασχίζει την ακμή slab (κορυφή x-max έξω) → outside-slab. */
function outsideParams(slab: SlabEntity): SlabOpeningParams {
  // Center (9900,9900): default shaft 1500 → 9150..10650, x-max 10650 > 10000.
  return buildDefaultSlabOpeningParams(slab, { x: 9900, y: 9900 }, { kind: 'shaft' }, 'mm');
}

describe('buildSlabOpeningEntity — outside-slab tolerance (ADR-632 Φ5)', () => {
  it('default (strict) + outline εκτός slab → ok:false (χειροκίνητο commit αμετάβλητο)', () => {
    const slab = makeSlab();
    const result = buildSlabOpeningEntity(outsideParams(slab), slab, '0');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.hardErrors).toContain(OUTLINE_OUTSIDE_SLAB_KEY);
    }
  });

  it('allowOutsideSlab + outline εκτός slab → ok:true + soft warning badge', () => {
    const slab = makeSlab();
    const result = buildSlabOpeningEntity(outsideParams(slab), slab, '0', { allowOutsideSlab: true });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.entity.type).toBe('slab-opening');
      expect(result.entity.validation.hasCodeViolations).toBe(true);
      expect(result.entity.validation.violationKeys).toContain(OUTLINE_AT_SLAB_EDGE_WARNING_KEY);
    }
  });

  it('allowOutsideSlab + genuine hard error (self-intersecting) → ok:false (block)', () => {
    const slab = makeSlab();
    // Bowtie outline — self-intersecting· ΔΕΝ είναι το tolerable outside-slab.
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
    const result = buildSlabOpeningEntity(params, slab, '0', { allowOutsideSlab: true });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.hardErrors).toContain('slabOpening.validation.hardErrors.selfIntersecting');
      // Το outside-slab δεν πρέπει να «κρύψει» πραγματικά hard errors.
      expect(result.hardErrors).not.toContain(OUTLINE_OUTSIDE_SLAB_KEY);
    }
  });

  it('allowOutsideSlab + εντός slab → ok:true, καμία code violation (badge off)', () => {
    const slab = makeSlab();
    // Default shaft centered (5000,5000) → 4250..5750, καθαρά εντός.
    const params = buildDefaultSlabOpeningParams(slab, { x: 5000, y: 5000 }, { kind: 'shaft' }, 'mm');
    const result = buildSlabOpeningEntity(params, slab, '0', { allowOutsideSlab: true });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.entity.validation.hasCodeViolations).toBe(false);
      expect(result.entity.validation.violationKeys).not.toContain(OUTLINE_AT_SLAB_EDGE_WARNING_KEY);
    }
  });

  it('idOverride εξακολουθεί να δουλεύει μέσω options (deterministic id, Φ5)', () => {
    const slab = makeSlab();
    const params = buildDefaultSlabOpeningParams(slab, { x: 5000, y: 5000 }, { kind: 'shaft' }, 'mm');
    const result = buildSlabOpeningEntity(params, slab, '0', { idOverride: 'slbopn_fixed' });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.entity.id).toBe('slbopn_fixed');
  });
});
