/**
 * Furniture Factory (ADR-410).
 *
 * Mirror of `mep-fixture.factory.ts`. Pure factory for `FurnitureEntity` with
 * IfcEntityMixin auto-population.
 *
 * Auto-populated:
 *   - `id`      : enterprise furniture ID (`generateFurnitureId`, SOS N.6)
 *   - `ifcGuid` : 22-char IFC4 GlobalId, generated ONCE — never regenerate
 *   - `ifcType` : 'IfcFurniture'
 *   - `validation` : empty `BimValidation` shell unless supplied
 *
 * @see docs/centralized-systems/reference/adrs/ADR-410-cc0-mesh-furniture-import.md
 */

import {
  generateFurnitureId,
  generateIfcGuid,
} from '@/services/enterprise-id-convenience';
import { makeBimValidation } from '@/subapps/dxf-viewer/bim/types/bim-base';
import type {
  FurnitureEntity,
  FurnitureGeometry,
  FurnitureParams,
} from '@/subapps/dxf-viewer/bim/types/furniture-types';
import type { BimValidation } from '@/subapps/dxf-viewer/bim/types/bim-base';
import type { IfcPropertySet } from '@/subapps/dxf-viewer/bim/types/ifc-entity-mixin';

export interface CreateFurnitureInput {
  /** Required: param block. */
  params: FurnitureParams;
  /** Required: pre-computed geometry cache (caller responsibility). */
  geometry: FurnitureGeometry;
  /** Required: BaseEntity stable layer id (ADR-358 Phase 9E-6e). */
  layerId: string;
  /** Optional `visible` flag (BaseEntity). Default unset. */
  visible?: boolean;
  /** Optional override (test-only). Default = enterprise furniture ID. */
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
 * Produce a new `FurnitureEntity` with IFC mixin auto-fill.
 *
 * @example
 * createFurniture({ params: { kind:'chair', assetId:'chair_01', position,
 *   rotationDeg:0, widthMm:500, depthMm:520, heightMm:900,
 *   mountingElevationMm:0 }, geometry, layerId });
 */
export function createFurniture(input: CreateFurnitureInput): FurnitureEntity {
  const entity: FurnitureEntity = {
    id: input.id ?? generateFurnitureId(),
    type: 'furniture',
    kind: input.params.kind,
    layerId: input.layerId,
    params: input.params,
    geometry: input.geometry,
    validation: input.validation ?? makeBimValidation(),
    ifcGuid: input.ifcGuid ?? generateIfcGuid(),
    ifcType: 'IfcFurniture',
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
