/**
 * Furniture persistence — pure doc→entity converter.
 * Extracted from `useFurniturePersistence.ts` so the cross-floor BIM loader
 * (ADR-469) can hydrate furniture without pulling the hook's React/EventBus chain.
 * Behavior-preserving (mirror of the structural persistence-helper splits).
 *
 * @module hooks/data/furniture-persistence-helpers
 * @see ./useFurniturePersistence.ts
 * @see ../../bim/persistence/cross-floor-bim-loader.ts
 */

import type { FurnitureEntity } from '../../bim/types/furniture-types';
import {
  computeFurnitureGeometry,
  validateFurnitureParams,
} from '../../bim/furniture/furniture-geometry';
import type { FurnitureDoc } from '../../bim/furniture/furniture-firestore-service';

/** Build scene-side `FurnitureEntity` from a persisted `FurnitureDoc`. */
export function furnitureDocToEntity(doc: FurnitureDoc): FurnitureEntity {
  const validation = doc.validation ?? validateFurnitureParams(doc.params).bimValidation;
  return {
    id: doc.id,
    type: 'furniture',
    kind: doc.kind,
    layerId: doc.layerId ?? '0',
    params: doc.params,
    geometry: doc.geometry ?? computeFurnitureGeometry(doc.params),
    validation,
    visible: true,
  } as FurnitureEntity;
}
