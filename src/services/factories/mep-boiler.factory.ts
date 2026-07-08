/**
 * Heating Boiler Factory (ADR-408 Εύρος Β #2).
 *
 * Mirror of `mep-radiator.factory.ts`. Pure factory for `MepBoilerEntity` with
 * IfcEntityMixin auto-population.
 *
 * Auto-populated:
 *   - `id`      : enterprise boiler ID (`generateMepBoilerId`, SOS N.6)
 *   - `ifcGuid` : 22-char IFC4 GlobalId, generated ONCE — never regenerate
 *   - `ifcType` : 'IfcBoiler'
 *   - `validation` : empty `BimValidation` shell unless supplied
 *
 * @see docs/centralized-systems/reference/adrs/ADR-408-mep-connectors-and-systems.md
 */

import {
  generateMepBoilerId,
} from '@/services/enterprise-id-convenience';
import type {
  MepBoilerEntity,
  MepBoilerGeometry,
  MepBoilerParams,
} from '@/subapps/dxf-viewer/bim/types/mep-boiler-types';
import {
  type CreateBimEntityInputBase,
  assembleBimEntity,
} from '@/services/factories/bim-entity-factory-base';

export interface CreateMepBoilerInput extends CreateBimEntityInputBase {
  /** Required: param block. */
  params: MepBoilerParams;
  /** Required: pre-computed geometry cache (caller responsibility). */
  geometry: MepBoilerGeometry;
}

/**
 * Produce a new `MepBoilerEntity` with IFC mixin auto-fill.
 */
export function createMepBoiler(input: CreateMepBoilerInput): MepBoilerEntity {
  return assembleBimEntity(
    {
      type: 'mep-boiler',
      kind: input.params.kind,
      layerId: input.layerId,
      params: input.params,
      geometry: input.geometry,
      ifcType: 'IfcBoiler',
      generateId: generateMepBoilerId,
    },
    input,
  );
}
