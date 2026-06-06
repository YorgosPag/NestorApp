/**
 * Floor Finish Factory (ADR-419).
 *
 * Pure factory για δημιουργία `FloorFinishEntity` με IfcEntityMixin auto-population
 * (ifcGuid + ifcType='IfcCovering'). Δεν γράφει σε Firestore — caller κάνει persist.
 *
 * Auto-populated:
 *   - `id`         : enterprise floor-finish ID (prefix 'ffl', N.6)
 *   - `kind`       : materialId (stable catalog slug — 'floor-wood-oak' κ.ά.)
 *   - `ifcGuid`    : 22-char IFC4 GlobalId, generated ONCE — never regenerate
 *   - `ifcType`    : 'IfcCovering' (πάντα — PredefinedType=FLOORING from serializer)
 *   - `validation` : empty `BimValidation` shell (ή caller-supplied)
 *
 * @see bim/types/floor-finish-types.ts
 * @see src/services/factories/roof.factory.ts — το πρότυπο
 */

import {
  generateFloorFinishId,
  generateIfcGuid,
} from '@/services/enterprise-id-convenience';
import type {
  FloorFinishEntity,
  FloorFinishGeometry,
  FloorFinishParams,
} from '@/subapps/dxf-viewer/bim/types/floor-finish-types';
import { makeBimValidation } from '@/subapps/dxf-viewer/bim/types/bim-base';
import type { BimValidation } from '@/subapps/dxf-viewer/bim/types/bim-base';
import type { IfcPropertySet } from '@/subapps/dxf-viewer/bim/types/ifc-entity-mixin';

export interface CreateFloorFinishInput {
  /** Required: param block (footprint polygon + materialId + thicknessMm + finishLevel). */
  params: FloorFinishParams;
  /** Required: pre-computed geometry cache (caller responsibility). */
  geometry: FloorFinishGeometry;
  /** Required: BaseEntity stable layer id. */
  layerId: string;
  /** Optional `visible` flag (BaseEntity). Default unset. */
  visible?: boolean;
  /** Optional override (test-only). Default = enterprise floor-finish ID. */
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
 * Παράγει νέο `FloorFinishEntity` με IFC mixin auto-fill.
 *
 * @example
 * createFloorFinish({ params: { footprint, materialId:'floor-wood-oak',
 *   thicknessMm:15, finishLevel:0 }, geometry, layerId:'lyr_x' });
 *   // → ifcType='IfcCovering'
 */
export function createFloorFinish(input: CreateFloorFinishInput): FloorFinishEntity {
  const entity: FloorFinishEntity = {
    id: input.id ?? generateFloorFinishId(),
    type: 'floor-finish',
    kind: input.params.materialId,
    layerId: input.layerId,
    params: input.params,
    geometry: input.geometry,
    validation: input.validation ?? makeBimValidation(),
    ifcGuid: input.ifcGuid ?? generateIfcGuid(),
    ifcType: 'IfcCovering',
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
