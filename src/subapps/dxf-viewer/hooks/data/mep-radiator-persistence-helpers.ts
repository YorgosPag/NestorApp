/**
 * MEP-radiator persistence — pure doc→entity converter.
 * Extracted from `useMepRadiatorPersistence.ts` so the cross-floor BIM loader
 * (ADR-469) can hydrate heating radiators without pulling the hook's React/EventBus
 * chain. Behavior-preserving (mirror of the structural persistence-helper splits).
 *
 * @module hooks/data/mep-radiator-persistence-helpers
 * @see ./useMepRadiatorPersistence.ts
 * @see ../../bim/persistence/cross-floor-bim-loader.ts
 */

import type { MepRadiatorEntity } from '../../bim/types/mep-radiator-types';
import {
  computeMepRadiatorGeometry,
  validateMepRadiatorParams,
} from '../../bim/mep-radiators/mep-radiator-geometry';
import type { MepRadiatorDoc } from '../../bim/mep-radiators/mep-radiator-firestore-service';

/** Build scene-side `MepRadiatorEntity` from a persisted `MepRadiatorDoc`. */
export function mepRadiatorDocToEntity(doc: MepRadiatorDoc): MepRadiatorEntity {
  const validation = doc.validation ?? validateMepRadiatorParams(doc.params).bimValidation;
  return {
    id: doc.id,
    type: 'mep-radiator',
    kind: doc.kind,
    layerId: doc.layerId ?? '0',
    params: doc.params,
    geometry: doc.geometry ?? computeMepRadiatorGeometry(doc.params),
    validation,
    visible: true,
  } as MepRadiatorEntity;
}
