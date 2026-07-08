/**
 * Domestic Hot Water Heater Factory (ADR-408 DHW / θερμοσίφωνας).
 *
 * Mirror of `mep-boiler.factory.ts`. Pure factory for `MepWaterHeaterEntity` with
 * IfcEntityMixin auto-population.
 *
 * Auto-populated:
 *   - `id`      : enterprise water-heater ID (`generateMepWaterHeaterId`, SOS N.6)
 *   - `ifcGuid` : 22-char IFC4 GlobalId, generated ONCE — never regenerate
 *   - `ifcType` : 'IfcUnitaryEquipment'
 *   - `validation` : empty `BimValidation` shell unless supplied
 *
 * @see docs/centralized-systems/reference/adrs/ADR-408-mep-connectors-and-systems.md
 */

import {
  generateMepWaterHeaterId,
} from '@/services/enterprise-id-convenience';
import type {
  MepWaterHeaterEntity,
  MepWaterHeaterGeometry,
  MepWaterHeaterParams,
} from '@/subapps/dxf-viewer/bim/types/mep-water-heater-types';
import {
  type CreateBimEntityInputBase,
  assembleBimEntity,
} from '@/services/factories/bim-entity-factory-base';

export interface CreateMepWaterHeaterInput extends CreateBimEntityInputBase {
  /** Required: param block. */
  params: MepWaterHeaterParams;
  /** Required: pre-computed geometry cache (caller responsibility). */
  geometry: MepWaterHeaterGeometry;
}

/**
 * Produce a new `MepWaterHeaterEntity` with IFC mixin auto-fill.
 */
export function createMepWaterHeater(input: CreateMepWaterHeaterInput): MepWaterHeaterEntity {
  return assembleBimEntity(
    {
      type: 'mep-water-heater',
      kind: input.params.kind,
      layerId: input.layerId,
      params: input.params,
      geometry: input.geometry,
      ifcType: 'IfcUnitaryEquipment',
      generateId: generateMepWaterHeaterId,
    },
    input,
  );
}
