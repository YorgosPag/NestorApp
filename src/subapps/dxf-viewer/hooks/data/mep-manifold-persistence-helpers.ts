/**
 * MEP-manifold persistence — pure doc→entity converter.
 * Extracted from `useMepManifoldPersistence.ts` so the cross-floor BIM loader
 * (ADR-469) can hydrate plumbing manifolds without pulling the hook's React/EventBus
 * chain. Behavior-preserving (mirror of the structural persistence-helper splits).
 *
 * @module hooks/data/mep-manifold-persistence-helpers
 * @see ./useMepManifoldPersistence.ts
 * @see ../../bim/persistence/cross-floor-bim-loader.ts
 */

import type { MepManifoldEntity } from '../../bim/types/mep-manifold-types';
import {
  computeMepManifoldGeometry,
  validateMepManifoldParams,
} from '../../bim/mep-manifolds/mep-manifold-geometry';
import type { MepManifoldDoc } from '../../bim/mep-manifolds/mep-manifold-firestore-service';

/** Build scene-side `MepManifoldEntity` from a persisted `MepManifoldDoc`. */
export function mepManifoldDocToEntity(doc: MepManifoldDoc): MepManifoldEntity {
  const validation = doc.validation ?? validateMepManifoldParams(doc.params).bimValidation;
  return {
    id: doc.id,
    type: 'mep-manifold',
    kind: doc.kind,
    layerId: doc.layerId ?? '0',
    params: doc.params,
    geometry: doc.geometry ?? computeMepManifoldGeometry(doc.params),
    validation,
    visible: true,
  } as MepManifoldEntity;
}
