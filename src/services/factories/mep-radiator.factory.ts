/**
 * Heating Radiator Factory (ADR-408 Εύρος Β #1).
 *
 * Mirror of `mep-manifold.factory.ts`. Pure factory for `MepRadiatorEntity` with
 * IfcEntityMixin auto-population.
 *
 * Auto-populated:
 *   - `id`      : enterprise radiator ID (`generateMepRadiatorId`, SOS N.6)
 *   - `ifcGuid` : 22-char IFC4 GlobalId, generated ONCE — never regenerate
 *   - `ifcType` : 'IfcSpaceHeater'
 *   - `validation` : empty `BimValidation` shell unless supplied
 *
 * @see docs/centralized-systems/reference/adrs/ADR-408-mep-connectors-and-systems.md
 */

import {
  generateMepRadiatorId,
} from '@/services/enterprise-id-convenience';
import type {
  MepRadiatorEntity,
  MepRadiatorGeometry,
  MepRadiatorParams,
} from '@/subapps/dxf-viewer/bim/types/mep-radiator-types';
import {
  type CreateBimEntityInputBase,
  assembleBimEntity,
} from '@/services/factories/bim-entity-factory-base';

export interface CreateMepRadiatorInput extends CreateBimEntityInputBase {
  /** Required: param block. */
  params: MepRadiatorParams;
  /** Required: pre-computed geometry cache (caller responsibility). */
  geometry: MepRadiatorGeometry;
}

/**
 * Produce a new `MepRadiatorEntity` with IFC mixin auto-fill.
 */
export function createMepRadiator(input: CreateMepRadiatorInput): MepRadiatorEntity {
  return assembleBimEntity(
    {
      type: 'mep-radiator',
      kind: input.params.kind,
      layerId: input.layerId,
      params: input.params,
      geometry: input.geometry,
      ifcType: 'IfcSpaceHeater',
      generateId: generateMepRadiatorId,
    },
    input,
  );
}
