/**
 * MEP Fitting Factory (ADR-408 Φ11).
 *
 * Mirror of `mep-segment.factory.ts`. Pure factory for `MepFittingEntity`
 * (point-based junction element — elbow / coupling / reducer / tee / cross /
 * cap) with IfcEntityMixin auto-population.
 *
 * Auto-populated:
 *   - `id`      : enterprise MEP-fitting ID (`generateMepFittingId`, SOS N.6)
 *   - `ifcGuid` : 22-char IFC4 GlobalId, generated ONCE — never regenerate
 *   - `ifcType` : derived from domain (`IfcPipeFitting` | `IfcDuctFitting`)
 *   - `kind`    : the fitting topology (`params.kind`)
 *   - `validation` : empty `BimValidation` shell unless supplied
 *
 * @see docs/centralized-systems/reference/adrs/ADR-408-mep-connectors-and-systems.md §Φ11
 */

import {
  generateMepFittingId,
} from '@/services/enterprise-id-convenience';
import {
  mepFittingIfcType,
  type MepFittingEntity,
  type MepFittingGeometry,
  type MepFittingParams,
} from '@/subapps/dxf-viewer/bim/types/mep-fitting-types';
import {
  type CreateBimEntityInputBase,
  assembleBimEntity,
} from '@/services/factories/bim-entity-factory-base';

export interface CreateMepFittingInput extends CreateBimEntityInputBase {
  params: MepFittingParams;
  geometry: MepFittingGeometry;
}

/** Produce a new `MepFittingEntity` with IFC mixin auto-fill. */
export function createMepFitting(input: CreateMepFittingInput): MepFittingEntity {
  return assembleBimEntity(
    {
      type: 'mep-fitting',
      kind: input.params.kind,
      layerId: input.layerId,
      params: input.params,
      geometry: input.geometry,
      ifcType: mepFittingIfcType(input.params.domain),
      generateId: generateMepFittingId,
    },
    input,
  );
}
