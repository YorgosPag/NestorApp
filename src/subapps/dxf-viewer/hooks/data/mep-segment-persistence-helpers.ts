/**
 * MEP-segment persistence — pure doc→entity converter.
 * Extracted from `useMepSegmentPersistence.ts` so the cross-floor BIM loader
 * (ADR-469) can hydrate MEP segments without pulling the hook's React/EventBus
 * chain. Behavior-preserving (mirror of the persistence-helper splits).
 *
 * @module hooks/data/mep-segment-persistence-helpers
 * @see ./useMepSegmentPersistence.ts
 * @see ../../bim/persistence/cross-floor-bim-loader.ts
 */

import type { MepSegmentEntity } from '../../bim/types/mep-segment-types';
import { computeMepSegmentGeometry } from '../../bim/geometry/mep-segment-geometry';
import { makeBimValidation } from '../../bim/types/bim-base';
import type { MepSegmentDoc } from '../../bim/mep-segments/mep-segment-firestore-service';

/** Build scene-side `MepSegmentEntity` from a persisted `MepSegmentDoc`. */
export function mepSegmentDocToEntity(d: MepSegmentDoc): MepSegmentEntity {
  return {
    id: d.id,
    type: 'mep-segment',
    kind: d.kind,
    layerId: d.layerId ?? '0',
    params: d.params,
    geometry: d.geometry ?? computeMepSegmentGeometry(d.params),
    validation: d.validation ?? makeBimValidation(),
    visible: true,
    // IFC mixin fields — derived from domain; older docs may not persist them.
    ifcType: d.params.domain === 'pipe' ? 'IfcPipeSegment' : 'IfcDuctSegment',
  } as MepSegmentEntity;
}
