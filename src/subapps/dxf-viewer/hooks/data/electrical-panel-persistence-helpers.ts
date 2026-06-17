/**
 * Electrical-panel persistence — pure doc→entity converter.
 * Extracted from `useElectricalPanelPersistence.ts` so the cross-floor BIM loader
 * (ADR-469) can hydrate electrical panels without pulling the hook's React/EventBus
 * chain. Behavior-preserving (mirror of the structural persistence-helper splits).
 *
 * @module hooks/data/electrical-panel-persistence-helpers
 * @see ./useElectricalPanelPersistence.ts
 * @see ../../bim/persistence/cross-floor-bim-loader.ts
 */

import type { ElectricalPanelEntity } from '../../bim/types/electrical-panel-types';
import {
  computeElectricalPanelGeometry,
  validateElectricalPanelParams,
} from '../../bim/electrical-panels/electrical-panel-geometry';
import type { ElectricalPanelDoc } from '../../bim/electrical-panels/electrical-panel-firestore-service';

/** Build scene-side `ElectricalPanelEntity` from a persisted `ElectricalPanelDoc`. */
export function electricalPanelDocToEntity(doc: ElectricalPanelDoc): ElectricalPanelEntity {
  const validation = doc.validation ?? validateElectricalPanelParams(doc.params).bimValidation;
  return {
    id: doc.id,
    type: 'electrical-panel',
    kind: doc.kind,
    layerId: doc.layerId ?? '0',
    params: doc.params,
    geometry: doc.geometry ?? computeElectricalPanelGeometry(doc.params),
    validation,
    visible: true,
  } as ElectricalPanelEntity;
}
