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
  generateIfcGuid,
} from '@/services/enterprise-id-convenience';
import { makeBimValidation } from '@/subapps/dxf-viewer/bim/types/bim-base';
import type {
  ElectricalPanelEntity,
  ElectricalPanelGeometry,
  ElectricalPanelParams,
} from '@/subapps/dxf-viewer/bim/types/electrical-panel-types';
import type { BimValidation } from '@/subapps/dxf-viewer/bim/types/bim-base';
import type { IfcPropertySet } from '@/subapps/dxf-viewer/bim/types/ifc-entity-mixin';

export interface CreateElectricalPanelInput {
  /** Required: param block. */
  params: ElectricalPanelParams;
  /** Required: pre-computed geometry cache (caller responsibility). */
  geometry: ElectricalPanelGeometry;
  /** Required: BaseEntity stable layer id (ADR-358 Phase 9E-6e). */
  layerId: string;
  /** Optional `visible` flag (BaseEntity). Default unset. */
  visible?: boolean;
  /** Optional override (test-only). Default = enterprise electrical-panel ID. */
  id?: string;
  /** Optional override (test-only). Default = generateIfcGuid(). */
  ifcGuid?: string;
  /** Optional sparse IFC Property Sets payload. */
  pset?: IfcPropertySet;
  /** Optional validation block. Default = empty BimValidation. */
  validation?: BimValidation;
  /** Optional tenant fields — pass-through. */
  companyId?: string;
  projectId?: string;
  buildingId?: string;
  floorplanId?: string;
  floorId?: string;
  createdBy?: string;
  updatedBy?: string;
}

/**
 * Produce a new `ElectricalPanelEntity` with IFC mixin auto-fill.
 */
export function createElectricalPanel(input: CreateElectricalPanelInput): ElectricalPanelEntity {
  const entity: ElectricalPanelEntity = {
    id: input.id ?? generateElectricalPanelId(),
    type: 'electrical-panel',
    kind: input.params.kind,
    layerId: input.layerId,
    params: input.params,
    geometry: input.geometry,
    validation: input.validation ?? makeBimValidation(),
    ifcGuid: input.ifcGuid ?? generateIfcGuid(),
    ifcType: 'IfcElectricDistributionBoard',
    ...(input.visible !== undefined && { visible: input.visible }),
    ...(input.pset !== undefined && { pset: input.pset }),
    ...(input.companyId !== undefined && { companyId: input.companyId }),
    ...(input.projectId !== undefined && { projectId: input.projectId }),
    ...(input.buildingId !== undefined && { buildingId: input.buildingId }),
    ...(input.floorplanId !== undefined && { floorplanId: input.floorplanId }),
    ...(input.floorId !== undefined && { floorId: input.floorId }),
    ...(input.createdBy !== undefined && { createdBy: input.createdBy }),
    ...(input.updatedBy !== undefined && { updatedBy: input.updatedBy }),
  };
  return entity;
}
