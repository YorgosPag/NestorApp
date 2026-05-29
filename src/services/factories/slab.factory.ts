/**
 * Slab Factory (ADR-369 §9 Q7 + Q8) — Phase A4
 *
 * Pure factory function για δημιουργία `SlabEntity` με ADR-369 top-face
 * semantic + IfcEntityMixin auto-population (ifcGuid + ifcType='IfcSlab').
 * Δεν γράφει σε Firestore — caller κάνει persist.
 *
 * Auto-populated:
 *   - `id`            : enterprise slab ID (prefix 'slab')
 *   - `ifcGuid`       : 22-char IFC4 GlobalId, generated ONCE — never regenerate
 *   - `ifcType`       : 'IfcSlab' (πάντα — όλα τα 5 SlabKinds map σε IfcSlab)
 *   - `validation`    : empty `BimValidation` shell
 *   - `geometryType`  : 'box' (DEFAULT_SLAB_GEOMETRY_TYPE)
 *
 * Validation:
 *   - geometryType='tilted' → slope required (direction + angle), throws αλλιώς.
 *   - geometryType='box' με slope set → throws (mutually exclusive).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-369-bim-elevation-convention-revit-alignment.md §9 Q7, Q8
 */

import {
  generateSlabId,
  generateIfcGuid,
} from '@/services/enterprise-id-convenience';
import {
  DEFAULT_SLAB_GEOMETRY_TYPE,
  type SlabEntity,
  type SlabGeometry,
  type SlabGeometryType,
  type SlabKind,
  type SlabParams,
  type SlabSlope,
} from '@/subapps/dxf-viewer/bim/types/slab-types';
import { makeBimValidation } from '@/subapps/dxf-viewer/bim/types/bim-base';
import type { BimValidation } from '@/subapps/dxf-viewer/bim/types/bim-base';
import type { IfcPropertySet } from '@/subapps/dxf-viewer/bim/types/ifc-entity-mixin';

/** SlabParams χωρίς το ADR-369 `geometryType` (factory το γεμίζει με default). */
type SlabParamsCallerInput = Omit<SlabParams, 'geometryType'> & {
  geometryType?: SlabGeometryType;
  slope?: SlabSlope;
};

export interface CreateSlabInput {
  /** Required: param block (geometryType optional — factory defaults 'box'). */
  params: SlabParamsCallerInput;
  /** Required: pre-computed geometry cache (caller responsibility). */
  geometry: SlabGeometry;
  /** Required: BaseEntity stable layer id (ADR-358 Phase 9E-6e). */
  layerId: string;
  /** Optional `visible` flag (BaseEntity). Default unset. */
  visible?: boolean;
  /** Optional override (test-only). Default = enterprise slab ID. */
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

function resolveSlabParams(input: SlabParamsCallerInput): SlabParams {
  const geometryType = input.geometryType ?? DEFAULT_SLAB_GEOMETRY_TYPE;
  if (geometryType === 'tilted' && input.slope === undefined) {
    throw new Error(
      "createSlab: geometryType='tilted' απαιτεί slope (direction + angle).",
    );
  }
  if (geometryType === 'box' && input.slope !== undefined) {
    throw new Error(
      "createSlab: slope επιτρέπεται μόνο όταν geometryType='tilted'.",
    );
  }
  const { geometryType: _gt, ...rest } = input;
  void _gt;
  return {
    ...rest,
    geometryType,
    offsetFromStorey: input.offsetFromStorey ?? 0,
  };
}

/**
 * Παράγει νέο `SlabEntity` με ADR-369 geometryType default + IFC mixin auto-fill.
 *
 * @throws Error αν geometryType='tilted' χωρίς slope ή vice versa.
 *
 * @example
 * createSlab({ params: { kind:'floor', outline, levelElevation:0,
 *   thickness:200 }, geometry, layerId:'lyr_x' });
 * // → ifcType='IfcSlab', geometryType='box'
 */
export function createSlab(input: CreateSlabInput): SlabEntity {
  const params = resolveSlabParams(input.params);
  const entity: SlabEntity = {
    id: input.id ?? generateSlabId(),
    type: 'slab',
    kind: params.kind,
    layerId: input.layerId,
    params,
    geometry: input.geometry,
    validation: input.validation ?? makeBimValidation(),
    ifcGuid: input.ifcGuid ?? generateIfcGuid(),
    ifcType: 'IfcSlab',
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

// Re-export SlabKind for caller convenience (test ergonomics).
export type { SlabKind };
