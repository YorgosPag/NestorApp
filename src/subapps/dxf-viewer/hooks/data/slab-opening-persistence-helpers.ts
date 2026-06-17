/**
 * Slab-opening persistence — pure doc→entity converter.
 * Extracted from `useSlabOpeningPersistence.ts` so the cross-floor BIM loader
 * (ADR-469) can hydrate slab-openings without pulling the hook's React/EventBus
 * chain. Behavior-preserving (mirror of the structural persistence-helper splits).
 *
 * @module hooks/data/slab-opening-persistence-helpers
 * @see ./useSlabOpeningPersistence.ts
 * @see ../../bim/persistence/cross-floor-bim-loader.ts
 */

import type { SlabOpeningEntity } from '../../bim/types/slab-opening-types';
import { computeSlabOpeningGeometry } from '../../bim/geometry/slab-opening-geometry';
import { validateSlabOpeningParams } from '../../bim/validators/slab-opening-validator';
import type { SlabOpeningDoc } from '../../bim/slab-openings/slab-opening-firestore-service';

/**
 * Build scene-side `SlabOpeningEntity` από persisted `SlabOpeningDoc`.
 * Geometry + validation recomputed via SSoT pure functions.
 */
export function slabOpeningDocToEntity(doc: SlabOpeningDoc): SlabOpeningEntity {
  const validation = doc.validation ?? validateSlabOpeningParams(doc.params, null).bimValidation;
  return {
    id: doc.id,
    type: 'slab-opening',
    kind: doc.kind,
    layerId: doc.layerId ?? '0',
    params: doc.params,
    geometry: doc.geometry ?? computeSlabOpeningGeometry(doc.params),
    validation,
    visible: true,
  } as SlabOpeningEntity;
}
