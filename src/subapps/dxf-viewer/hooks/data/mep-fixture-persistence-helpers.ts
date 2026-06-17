/**
 * MEP-fixture persistence — pure doc→entity converter.
 * Extracted from `useMepFixturePersistence.ts` so the cross-floor BIM loader
 * (ADR-469) can hydrate MEP fixtures without pulling the hook's React/EventBus
 * chain. Behavior-preserving (mirror of the structural persistence-helper splits).
 *
 * @module hooks/data/mep-fixture-persistence-helpers
 * @see ./useMepFixturePersistence.ts
 * @see ../../bim/persistence/cross-floor-bim-loader.ts
 */

import type { MepFixtureEntity } from '../../bim/types/mep-fixture-types';
import {
  computeMepFixtureGeometry,
  validateMepFixtureParams,
} from '../../bim/mep-fixtures/mep-fixture-geometry';
import type { MepFixtureDoc } from '../../bim/mep-fixtures/mep-fixture-firestore-service';

/** Build scene-side `MepFixtureEntity` from a persisted `MepFixtureDoc`. */
export function mepFixtureDocToEntity(doc: MepFixtureDoc): MepFixtureEntity {
  const validation = doc.validation ?? validateMepFixtureParams(doc.params).bimValidation;
  return {
    id: doc.id,
    type: 'mep-fixture',
    kind: doc.kind,
    layerId: doc.layerId ?? '0',
    params: doc.params,
    geometry: doc.geometry ?? computeMepFixtureGeometry(doc.params),
    validation,
    visible: true,
  } as MepFixtureEntity;
}
