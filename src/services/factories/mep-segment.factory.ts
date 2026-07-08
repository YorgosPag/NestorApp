/**
 * MEP Segment Factory (ADR-408 Φ8).
 *
 * Mirror of `electrical-panel.factory.ts`. Pure factory for `MepSegmentEntity`
 * (unified duct/pipe linear element) with IfcEntityMixin auto-population.
 *
 * Auto-populated:
 *   - `id`      : enterprise MEP-segment ID (`generateMepSegmentId`, SOS N.6)
 *   - `ifcGuid` : 22-char IFC4 GlobalId, generated ONCE — never regenerate
 *   - `ifcType` : derived from domain (`IfcDuctSegment` | `IfcPipeSegment`)
 *   - `kind`    : the segment domain (`'duct'` | `'pipe'`)
 *   - `validation` : empty `BimValidation` shell unless supplied
 *
 * @see docs/centralized-systems/reference/adrs/ADR-408-mep-connectors-and-systems.md §Φ8
 */

import {
  generateMepSegmentId,
} from '@/services/enterprise-id-convenience';
import {
  mepSegmentIfcType,
  type MepSegmentEntity,
  type MepSegmentGeometry,
  type MepSegmentParams,
} from '@/subapps/dxf-viewer/bim/types/mep-segment-types';
import {
  type CreateBimEntityInputBase,
  assembleBimEntity,
} from '@/services/factories/bim-entity-factory-base';

export interface CreateMepSegmentInput extends CreateBimEntityInputBase {
  params: MepSegmentParams;
  geometry: MepSegmentGeometry;
}

/** Produce a new `MepSegmentEntity` with IFC mixin auto-fill. */
export function createMepSegment(input: CreateMepSegmentInput): MepSegmentEntity {
  return assembleBimEntity(
    {
      type: 'mep-segment',
      kind: input.params.domain,
      layerId: input.layerId,
      params: input.params,
      geometry: input.geometry,
      ifcType: mepSegmentIfcType(input.params.domain),
      generateId: generateMepSegmentId,
    },
    input,
  );
}
