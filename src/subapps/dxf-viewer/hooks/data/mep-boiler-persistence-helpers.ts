/**
 * MEP-boiler persistence — pure doc→entity converter.
 * Extracted from `useMepBoilerPersistence.ts` so the cross-floor BIM loader
 * (ADR-469) can hydrate heating boilers without pulling the hook's React/EventBus
 * chain. Behavior-preserving (mirror of the structural persistence-helper splits).
 *
 * @module hooks/data/mep-boiler-persistence-helpers
 * @see ./useMepBoilerPersistence.ts
 * @see ../../bim/persistence/cross-floor-bim-loader.ts
 */

import type { MepBoilerEntity } from '../../bim/types/mep-boiler-types';
import {
  computeMepBoilerGeometry,
  validateMepBoilerParams,
} from '../../bim/mep-boilers/mep-boiler-geometry';
import type { MepBoilerDoc } from '../../bim/mep-boilers/mep-boiler-firestore-service';

/** Build scene-side `MepBoilerEntity` from a persisted `MepBoilerDoc`. */
export function mepBoilerDocToEntity(doc: MepBoilerDoc): MepBoilerEntity {
  const validation = doc.validation ?? validateMepBoilerParams(doc.params).bimValidation;
  return {
    id: doc.id,
    type: 'mep-boiler',
    kind: doc.kind,
    layerId: doc.layerId ?? '0',
    params: doc.params,
    geometry: doc.geometry ?? computeMepBoilerGeometry(doc.params),
    validation,
    visible: true,
  } as MepBoilerEntity;
}
