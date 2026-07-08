/**
 * Electrical Panel Factory (ADR-408 Φ3).
 *
 * Mirror of `mep-fixture.factory.ts`. Pure factory for `ElectricalPanelEntity`
 * with IfcEntityMixin auto-population.
 *
 * Auto-populated:
 *   - `id`      : enterprise electrical-panel ID (`generateElectricalPanelId`, SOS N.6)
 *   - `ifcGuid` : 22-char IFC4 GlobalId, generated ONCE — never regenerate
 *   - `ifcType` : 'IfcElectricDistributionBoard'
 *   - `validation` : empty `BimValidation` shell unless supplied
 *
 * @see docs/centralized-systems/reference/adrs/ADR-408-mep-connectors-and-systems.md
 */

import {
  generateElectricalPanelId,
} from '@/services/enterprise-id-convenience';
import type {
  ElectricalPanelEntity,
  ElectricalPanelGeometry,
  ElectricalPanelParams,
} from '@/subapps/dxf-viewer/bim/types/electrical-panel-types';
import {
  type CreateBimEntityInputBase,
  assembleBimEntity,
} from '@/services/factories/bim-entity-factory-base';

export interface CreateElectricalPanelInput extends CreateBimEntityInputBase {
  /** Required: param block. */
  params: ElectricalPanelParams;
  /** Required: pre-computed geometry cache (caller responsibility). */
  geometry: ElectricalPanelGeometry;
}

/**
 * Produce a new `ElectricalPanelEntity` with IFC mixin auto-fill.
 */
export function createElectricalPanel(input: CreateElectricalPanelInput): ElectricalPanelEntity {
  return assembleBimEntity(
    {
      type: 'electrical-panel',
      kind: input.params.kind,
      layerId: input.layerId,
      params: input.params,
      geometry: input.geometry,
      ifcType: 'IfcElectricDistributionBoard',
      generateId: generateElectricalPanelId,
    },
    input,
  );
}
