/**
 * Floorplan-symbol persistence — pure doc→entity converter.
 * Extracted from `useFloorplanSymbolPersistence.ts` so the cross-floor BIM loader
 * (ADR-469) can hydrate floorplan symbols without pulling the hook's React/EventBus
 * chain. Behavior-preserving (mirror of the structural persistence-helper splits).
 *
 * @module hooks/data/floorplan-symbol-persistence-helpers
 * @see ./useFloorplanSymbolPersistence.ts
 * @see ../../bim/persistence/cross-floor-bim-loader.ts
 */

import type { FloorplanSymbolEntity } from '../../bim/types/floorplan-symbol-types';
import {
  computeFloorplanSymbolGeometry,
  validateFloorplanSymbolParams,
} from '../../bim/floorplan-symbols/floorplan-symbol-geometry';
import type { FloorplanSymbolDoc } from '../../bim/floorplan-symbols/floorplan-symbol-firestore-service';

/** Build scene-side `FloorplanSymbolEntity` from a persisted doc. */
export function floorplanSymbolDocToEntity(doc: FloorplanSymbolDoc): FloorplanSymbolEntity {
  const validation = doc.validation ?? validateFloorplanSymbolParams(doc.params).bimValidation;
  return {
    id: doc.id,
    type: 'floorplan-symbol',
    kind: doc.kind,
    layerId: doc.layerId ?? '0',
    params: doc.params,
    geometry: doc.geometry ?? computeFloorplanSymbolGeometry(doc.params),
    validation,
    visible: true,
  } as FloorplanSymbolEntity;
}
