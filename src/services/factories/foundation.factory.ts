/**
 * Foundation Factory (ADR-436, Slice 0).
 *
 * Mirror του `column.factory.ts`. Pure factory function για `FoundationEntity`
 * με IfcEntityMixin auto-population. ΧΩΡΙΣ Firestore write (persistence = Slice 1).
 *
 * Auto-populated:
 *   - `id`              : enterprise foundation ID (prefix 'fnd', ADR-294)
 *   - `ifcGuid`         : 22-char IFC4 GlobalId, generated ONCE — never regenerate
 *   - `ifcType`         : 'IfcFooting' (πάντα — όλα τα 3 kinds map σε IfcFooting)
 *   - `predefinedType`  : από `FOUNDATION_IFC_MAP[kind]` (PAD/STRIP/FOOTING_BEAM)
 *   - `validation`      : empty `BimValidation` shell
 *
 * @see docs/centralized-systems/reference/adrs/ADR-436-bim-foundation-discipline.md
 */

import {
  generateFoundationId,
  generateIfcGuid,
} from '@/services/enterprise-id-convenience';
import { makeBimValidation } from '@/subapps/dxf-viewer/bim/types/bim-base';
import {
  FOUNDATION_IFC_MAP,
  type FoundationEntity,
  type FoundationGeometry,
  type FoundationParams,
} from '@/subapps/dxf-viewer/bim/types/foundation-types';
import type { BimValidation } from '@/subapps/dxf-viewer/bim/types/bim-base';
import type { IfcPropertySet } from '@/subapps/dxf-viewer/bim/types/ifc-entity-mixin';

export interface CreateFoundationInput {
  /** Required: param block (discriminated union ανά kind). */
  params: FoundationParams;
  /** Required: pre-computed geometry cache (caller responsibility, Slice 1). */
  geometry: FoundationGeometry;
  /** Required: BaseEntity stable layer id (ADR-358). */
  layerId: string;
  /** Optional `visible` flag (BaseEntity). Default unset. */
  visible?: boolean;
  /** Optional override (test-only). Default = enterprise foundation ID. */
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
 * Παράγει νέο `FoundationEntity` με IFC mixin auto-fill. `predefinedType`
 * προκύπτει ντετερμινιστικά από το `params.kind` (SSoT `FOUNDATION_IFC_MAP`).
 *
 * @example
 * createFoundation({ params: buildDefaultFoundationParams('pad'), geometry, layerId });
 * // → ifcType='IfcFooting', predefinedType='PAD_FOOTING'
 */
export function createFoundation(input: CreateFoundationInput): FoundationEntity {
  const { params } = input;
  const entity: FoundationEntity = {
    id: input.id ?? generateFoundationId(),
    type: 'foundation',
    kind: params.kind,
    layerId: input.layerId,
    params,
    geometry: input.geometry,
    validation: input.validation ?? makeBimValidation(),
    ifcGuid: input.ifcGuid ?? generateIfcGuid(),
    ifcType: 'IfcFooting',
    predefinedType: FOUNDATION_IFC_MAP[params.kind],
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
