/**
 * MEP-underfloor persistence — pure doc→entity converter.
 * Extracted from `useMepUnderfloorPersistence.ts` so the cross-floor BIM loader
 * (ADR-469) can hydrate underfloor heating loops without pulling the hook's
 * React/EventBus chain. Behavior-preserving (mirror of the persistence-helper splits).
 *
 * @module hooks/data/mep-underfloor-persistence-helpers
 * @see ./useMepUnderfloorPersistence.ts
 * @see ../../bim/persistence/cross-floor-bim-loader.ts
 */

import type { MepUnderfloorEntity } from '../../bim/types/mep-underfloor-types';
import {
  computeMepUnderfloorGeometry,
  validateMepUnderfloorParams,
} from '../../bim/mep-underfloor/mep-underfloor-geometry';
import type { MepUnderfloorDoc } from '../../bim/mep-underfloor/mep-underfloor-firestore-service';

/** Build scene-side `MepUnderfloorEntity` from a persisted `MepUnderfloorDoc`. */
export function mepUnderfloorDocToEntity(doc: MepUnderfloorDoc): MepUnderfloorEntity {
  const validation = doc.validation ?? validateMepUnderfloorParams(doc.params).bimValidation;
  return {
    id: doc.id,
    type: 'mep-underfloor',
    kind: doc.kind,
    layerId: doc.layerId ?? '0',
    params: doc.params,
    geometry: doc.geometry ?? computeMepUnderfloorGeometry(doc.params),
    validation,
    visible: true,
  } as MepUnderfloorEntity;
}
