/**
 * Railing persistence — pure doc→entity converter.
 * Extracted from `useRailingPersistence.ts` so the cross-floor BIM loader
 * (ADR-469) can hydrate railings without pulling the hook's React/EventBus chain.
 * Behavior-preserving (mirror of the structural persistence-helper splits).
 *
 * @module hooks/data/railing-persistence-helpers
 * @see ./useRailingPersistence.ts
 * @see ../../bim/persistence/cross-floor-bim-loader.ts
 */

import type { RailingEntity } from '../../bim/types/railing-types';
import {
  computeRailingGeometry,
  validateRailingParams,
} from '../../bim/railings/railing-geometry';
import type { RailingDoc } from '../../bim/railings/railing-firestore-service';

/** Build scene-side `RailingEntity` from a persisted `RailingDoc`. */
export function railingDocToEntity(doc: RailingDoc): RailingEntity {
  const validation = doc.validation ?? validateRailingParams(doc.params).bimValidation;
  return {
    id: doc.id,
    type: 'railing',
    kind: doc.kind,
    layerId: doc.layerId ?? '0',
    params: doc.params,
    geometry: doc.geometry ?? computeRailingGeometry(doc.params),
    validation,
    visible: true,
  } as RailingEntity;
}
