/**
 * MEP-water-heater persistence — pure doc→entity converter.
 * Extracted from `useMepWaterHeaterPersistence.ts` so the cross-floor BIM loader
 * (ADR-469) can hydrate DHW water heaters without pulling the hook's React/EventBus
 * chain. Behavior-preserving (mirror of the structural persistence-helper splits).
 *
 * @module hooks/data/mep-water-heater-persistence-helpers
 * @see ./useMepWaterHeaterPersistence.ts
 * @see ../../bim/persistence/cross-floor-bim-loader.ts
 */

import type { MepWaterHeaterEntity } from '../../bim/types/mep-water-heater-types';
import {
  computeMepWaterHeaterGeometry,
  validateMepWaterHeaterParams,
} from '../../bim/mep-water-heaters/mep-water-heater-geometry';
import type { MepWaterHeaterDoc } from '../../bim/mep-water-heaters/mep-water-heater-firestore-service';

/** Build scene-side `MepWaterHeaterEntity` from a persisted `MepWaterHeaterDoc`. */
export function mepWaterHeaterDocToEntity(doc: MepWaterHeaterDoc): MepWaterHeaterEntity {
  const validation = doc.validation ?? validateMepWaterHeaterParams(doc.params).bimValidation;
  return {
    id: doc.id,
    type: 'mep-water-heater',
    kind: doc.kind,
    layerId: doc.layerId ?? '0',
    params: doc.params,
    geometry: doc.geometry ?? computeMepWaterHeaterGeometry(doc.params),
    validation,
    visible: true,
  } as MepWaterHeaterEntity;
}
