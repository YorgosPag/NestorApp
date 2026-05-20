/**
 * Opening Factory (ADR-369 §9 Q8) — Phase A5
 *
 * Pure factory function για δημιουργία `OpeningEntity` με IfcEntityMixin
 * auto-population (ifcGuid + ifcType inferred από kind).
 * Δεν γράφει σε Firestore — caller κάνει persist.
 *
 * Auto-populated:
 *   - `id`       : enterprise opening ID (prefix 'opening')
 *   - `ifcGuid`  : 22-char IFC4 GlobalId, generated ONCE — never regenerate
 *   - `ifcType`  : inferred από kind:
 *       door / sliding-door / french-door → 'IfcDoor'
 *       window / fixed                    → 'IfcWindow'
 *   - `validation`: empty `BimValidation` shell
 *
 * @see docs/centralized-systems/reference/adrs/ADR-369-bim-elevation-convention-revit-alignment.md §9 Q8
 */

import {
  generateOpeningId,
  generateIfcGuid,
} from '@/services/enterprise-id-convenience';
import type {
  OpeningEntity,
  OpeningGeometry,
  OpeningKind,
  OpeningParams,
} from '@/subapps/dxf-viewer/bim/types/opening-types';
import { makeBimValidation } from '@/subapps/dxf-viewer/bim/types/bim-base';
import type { BimValidation, BimQuantityTakeoff } from '@/subapps/dxf-viewer/bim/types/bim-base';
import type { IfcPropertySet } from '@/subapps/dxf-viewer/bim/types/ifc-entity-mixin';

export interface CreateOpeningInput {
  /** Required: param block. */
  params: OpeningParams;
  /** Required: pre-computed geometry cache (caller responsibility). */
  geometry: OpeningGeometry;
  /** Required: BaseEntity stable layer id (ADR-358 Phase 9E-6e). */
  layerId: string;
  /** Optional `visible` flag (BaseEntity). Default unset. */
  visible?: boolean;
  /** Optional override (test-only). Default = enterprise opening ID. */
  id?: string;
  /** Optional override (test-only). Default = generateIfcGuid(). */
  ifcGuid?: string;
  /** Optional sparse IFC Property Sets payload. */
  pset?: IfcPropertySet;
  /** Optional validation block. Default = empty BimValidation. */
  validation?: BimValidation;
  /** Optional QTO block. */
  qto?: BimQuantityTakeoff;
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
 * Maps OpeningKind to IFC4 class.
 * door/sliding-door/french-door → IfcDoor (all hinged/sliding door types).
 * window/fixed → IfcWindow (all glazing-only elements).
 */
export function inferOpeningIfcType(kind: OpeningKind): 'IfcDoor' | 'IfcWindow' {
  if (kind === 'window' || kind === 'fixed') return 'IfcWindow';
  return 'IfcDoor';
}

/**
 * Παράγει νέο `OpeningEntity` με IfcEntityMixin auto-fill.
 *
 * @example
 * createOpening({ params: { kind:'door', wallId:'wall_x', offsetFromStart:500,
 *   width:900, height:2100, sillHeight:0 }, geometry, layerId:'lyr_x' });
 * // → ifcType='IfcDoor', ifcGuid=22-char UUID
 *
 * createOpening({ params: { kind:'window', ... }, geometry, layerId:'lyr_x' });
 * // → ifcType='IfcWindow'
 */
export function createOpening(input: CreateOpeningInput): OpeningEntity {
  const entity: OpeningEntity = {
    id: input.id ?? generateOpeningId(),
    type: 'opening',
    kind: input.params.kind,
    layerId: input.layerId,
    params: input.params,
    geometry: input.geometry,
    validation: input.validation ?? makeBimValidation(),
    ifcGuid: input.ifcGuid ?? generateIfcGuid(),
    ifcType: inferOpeningIfcType(input.params.kind),
    ...(input.visible !== undefined && { visible: input.visible }),
    ...(input.pset !== undefined && { pset: input.pset }),
    ...(input.qto !== undefined && { qto: input.qto }),
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

// Re-export for caller convenience (test ergonomics).
export type { OpeningKind };
