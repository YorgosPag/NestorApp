/**
 * Roof Factory (ADR-417, Φ1).
 *
 * Pure factory για δημιουργία `RoofEntity` με IfcEntityMixin auto-population
 * (ifcGuid + ifcType='IfcRoof'). Δεν γράφει σε Firestore — caller κάνει persist.
 *
 * Auto-populated:
 *   - `id`         : enterprise roof ID (prefix 'roof', N.6)
 *   - `ifcGuid`    : 22-char IFC4 GlobalId, generated ONCE — never regenerate
 *   - `ifcType`    : 'IfcRoof' (πάντα — PredefinedType = derived geometry.shape)
 *   - `validation` : empty `BimValidation` shell (ή caller-supplied)
 *
 * @see bim/types/roof-types.ts
 * @see src/services/factories/slab.factory.ts — το πρότυπο
 */

import {
  generateRoofId,
  generateIfcGuid,
} from '@/services/enterprise-id-convenience';
import type {
  RoofEntity,
  RoofGeometry,
  RoofParams,
} from '@/subapps/dxf-viewer/bim/types/roof-types';
import { makeBimValidation } from '@/subapps/dxf-viewer/bim/types/bim-base';
import type { BimValidation } from '@/subapps/dxf-viewer/bim/types/bim-base';
import type { RoofTypeParams } from '@/subapps/dxf-viewer/bim/types/bim-family-type';
import type { IfcPropertySet } from '@/subapps/dxf-viewer/bim/types/ifc-entity-mixin';

export interface CreateRoofInput {
  /** Required: param block (footprint + per-edge slopes + slopeUnit + basePivotZ). */
  params: RoofParams;
  /** Required: pre-computed geometry cache (caller responsibility). */
  geometry: RoofGeometry;
  /** Required: BaseEntity stable layer id. */
  layerId: string;
  /** Optional `visible` flag (BaseEntity). Default unset. */
  visible?: boolean;
  /** Optional override (test-only). Default = enterprise roof ID. */
  id?: string;
  /** Optional override (test-only). Default = generateIfcGuid(). */
  ifcGuid?: string;
  /** Optional sparse IFC Property Sets payload. */
  pset?: IfcPropertySet;
  /** Optional validation block. Default = empty BimValidation. */
  validation?: BimValidation;
  /** ADR-412 — FK → BimFamilyType.id (RoofType). */
  typeId?: string;
  /** ADR-412 — per-instance overrides of type-level params. */
  typeOverrides?: Partial<RoofTypeParams>;
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
 * Παράγει νέο `RoofEntity` με IFC mixin auto-fill.
 *
 * @example
 * createRoof({ params: { outline, edges, slopeUnit:'deg', basePivotZ:3000,
 *   thickness:434 }, geometry, layerId:'lyr_x' }); // → ifcType='IfcRoof'
 */
export function createRoof(input: CreateRoofInput): RoofEntity {
  const entity: RoofEntity = {
    id: input.id ?? generateRoofId(),
    type: 'roof',
    kind: 'roof',
    layerId: input.layerId,
    params: input.params,
    geometry: input.geometry,
    validation: input.validation ?? makeBimValidation(),
    ifcGuid: input.ifcGuid ?? generateIfcGuid(),
    ifcType: 'IfcRoof',
    ...(input.visible !== undefined && { visible: input.visible }),
    ...(input.pset !== undefined && { pset: input.pset }),
    ...(input.typeId !== undefined && { typeId: input.typeId }),
    ...(input.typeOverrides !== undefined && { typeOverrides: input.typeOverrides }),
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
