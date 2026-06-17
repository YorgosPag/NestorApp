/**
 * MEP-fitting persistence — pure doc→entity converter.
 * Extracted from `useMepFittingAutoReconciliation.ts` so the cross-floor BIM loader
 * (ADR-469) can hydrate MEP fittings without pulling the hook's React/EventBus
 * chain. Behavior-preserving (mirror of the persistence-helper splits).
 *
 * @module hooks/data/mep-fitting-persistence-helpers
 * @see ./useMepFittingAutoReconciliation.ts
 * @see ../../bim/persistence/cross-floor-bim-loader.ts
 */

import { mepFittingIfcType } from '../../bim/types/mep-fitting-types';
import type { MepFittingEntity } from '../../bim/types/mep-fitting-types';
import { computeMepFittingGeometry } from '../../bim/geometry/mep-fitting-geometry';
import { makeBimValidation } from '../../bim/types/bim-base';
import type { MepFittingDoc } from '../../bim/mep-fittings/mep-fitting-firestore-service';

/** Build a scene-side `MepFittingEntity` from a persisted `MepFittingDoc`. */
export function mepFittingDocToEntity(d: MepFittingDoc): MepFittingEntity {
  return {
    id: d.id,
    type: 'mep-fitting',
    kind: d.kind,
    layerId: d.layerId ?? '0',
    params: d.params,
    // ALWAYS recompute — geometry is a pure cache of params and the bend body
    // shape evolves with the renderer (a persisted square from an older build must
    // not pin a stale footprint). Cheap + idempotent.
    geometry: computeMepFittingGeometry(d.params),
    validation: d.validation ?? makeBimValidation(),
    visible: true,
    ifcType: mepFittingIfcType(d.params.domain),
  } as MepFittingEntity;
}
