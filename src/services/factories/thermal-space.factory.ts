/**
 * Thermal Space Factory (ADR-422 L0).
 *
 * Pure factory για δημιουργία `ThermalSpaceEntity` με IfcEntityMixin auto-population
 * (ifcGuid + ifcType='IfcSpace'). Δεν γράφει σε Firestore — caller κάνει persist.
 *
 * Auto-populated:
 *   - `id`         : enterprise thermal-space ID (prefix 'tsp', N.6)
 *   - `kind`       : useType (η χρήση χώρου — ΤΟΤΕΕ· 'bedroom'/'kitchen'/… κ.ά.)
 *   - `ifcGuid`    : 22-char IFC4 GlobalId, generated ONCE — never regenerate
 *   - `ifcType`    : 'IfcSpace' (πάντα — αναλυτικός χώρος HVAC)
 *   - `validation` : empty `BimValidation` shell (ή caller-supplied)
 *
 * @see bim/types/thermal-space-types.ts
 * @see src/services/factories/floor-finish.factory.ts — το πρότυπο (area entity)
 */

import {
  generateThermalSpaceId,
  generateIfcGuid,
} from '@/services/enterprise-id-convenience';
import type {
  ThermalSpaceEntity,
  ThermalSpaceGeometry,
  ThermalSpaceParams,
} from '@/subapps/dxf-viewer/bim/types/thermal-space-types';
import { makeBimValidation } from '@/subapps/dxf-viewer/bim/types/bim-base';
import type { BimValidation } from '@/subapps/dxf-viewer/bim/types/bim-base';
import type { IfcPropertySet } from '@/subapps/dxf-viewer/bim/types/ifc-entity-mixin';

export interface CreateThermalSpaceInput {
  /** Required: param block (footprint polygon + useType + ceilingHeightMm + overrides). */
  params: ThermalSpaceParams;
  /** Required: pre-computed geometry cache (caller responsibility). */
  geometry: ThermalSpaceGeometry;
  /** Required: BaseEntity stable layer id. */
  layerId: string;
  /** Optional `visible` flag (BaseEntity). Default unset. */
  visible?: boolean;
  /** Optional override (test-only). Default = enterprise thermal-space ID. */
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
 * Παράγει νέο `ThermalSpaceEntity` με IFC mixin auto-fill.
 *
 * @example
 * createThermalSpace({ params: { footprint, useType:'bedroom',
 *   ceilingHeightMm:3000 }, geometry, layerId:'lyr_x' });
 *   // → ifcType='IfcSpace', kind='bedroom'
 */
export function createThermalSpace(input: CreateThermalSpaceInput): ThermalSpaceEntity {
  const entity: ThermalSpaceEntity = {
    id: input.id ?? generateThermalSpaceId(),
    type: 'thermal-space',
    kind: input.params.useType,
    layerId: input.layerId,
    params: input.params,
    geometry: input.geometry,
    validation: input.validation ?? makeBimValidation(),
    ifcGuid: input.ifcGuid ?? generateIfcGuid(),
    ifcType: 'IfcSpace',
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
