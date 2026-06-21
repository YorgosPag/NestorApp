/**
 * Wall Covering Factory (ADR-511).
 *
 * Pure factory για δημιουργία `WallCoveringEntity` με IfcEntityMixin auto-population
 * (ifcGuid + ifcType='IfcCovering'). Δεν γράφει σε Firestore — caller κάνει persist.
 *
 * Auto-populated:
 *   - `id`         : enterprise wall-covering ID (prefix 'wcv', N.6)
 *   - `kind`       : παράγεται από το assembly (`resolveWallCoveringKind` — paint/plaster/knauf/tiles/mixed)
 *   - `ifcGuid`    : 22-char IFC4 GlobalId, generated ONCE — never regenerate
 *   - `ifcType`    : 'IfcCovering' (PredefinedType=CLADDING/INTERIOR from serializer)
 *   - `validation` : empty `BimValidation` shell (ή caller-supplied)
 *
 * @see src/subapps/dxf-viewer/bim/types/wall-covering-types.ts
 * @see src/services/factories/floor-finish.factory.ts — το πρότυπο
 */

import {
  generateWallCoveringId,
  generateIfcGuid,
} from '@/services/enterprise-id-convenience';
import {
  resolveWallCoveringKind,
  type WallCoveringEntity,
  type WallCoveringGeometry,
  type WallCoveringParams,
} from '@/subapps/dxf-viewer/bim/types/wall-covering-types';
import { makeBimValidation } from '@/subapps/dxf-viewer/bim/types/bim-base';
import type { BimValidation } from '@/subapps/dxf-viewer/bim/types/bim-base';
import type { IfcPropertySet } from '@/subapps/dxf-viewer/bim/types/ifc-entity-mixin';

export interface CreateWallCoveringInput {
  /** Required: param block (hostWallId + faceSide + span + height + layers assembly). */
  params: WallCoveringParams;
  /** Required: pre-computed geometry cache (caller responsibility). */
  geometry: WallCoveringGeometry;
  /** Required: BaseEntity stable layer id. */
  layerId: string;
  /** Optional `visible` flag (BaseEntity). Default unset. */
  visible?: boolean;
  /** Optional override (test-only). Default = enterprise wall-covering ID. */
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
 * Παράγει νέο `WallCoveringEntity` με IFC mixin auto-fill. Το `kind` derive-άρεται από το
 * assembly (το «βαρύτερο» υλικό ορίζει την κατηγορία για BOQ/filter).
 */
export function createWallCovering(input: CreateWallCoveringInput): WallCoveringEntity {
  const entity: WallCoveringEntity = {
    id: input.id ?? generateWallCoveringId(),
    type: 'wall-covering',
    kind: resolveWallCoveringKind(input.params.layers),
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
