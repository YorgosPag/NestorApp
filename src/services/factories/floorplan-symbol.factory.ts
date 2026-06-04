/**
 * Floorplan Symbol Factory (ADR-415 Φ1).
 *
 * Mirror of `furniture.factory.ts`. Pure factory for `FloorplanSymbolEntity` with
 * IfcEntityMixin auto-population. The `ifcType` is **category-driven** (Revit-
 * faithful): resolved from `params.category` via the category engine — a sanitary
 * symbol is `IfcSanitaryTerminal`, never `IfcFurniture`.
 *
 * Auto-populated:
 *   - `id`      : enterprise floorplan-symbol ID (`generateFloorplanSymbolId`, SOS N.6)
 *   - `ifcGuid` : 22-char IFC4 GlobalId, generated ONCE — never regenerate
 *   - `ifcType` : category-driven IFC4 class
 *   - `validation` : empty `BimValidation` shell unless supplied
 *
 * @see docs/centralized-systems/reference/adrs/ADR-415-2d-floorplan-symbol-library.md
 */

import {
  generateFloorplanSymbolId,
  generateIfcGuid,
} from '@/services/enterprise-id-convenience';
import { makeBimValidation } from '@/subapps/dxf-viewer/bim/types/bim-base';
import { resolveSymbolCategoryConfig } from '@/subapps/dxf-viewer/bim/floorplan-symbols/floorplan-symbol-categories';
import type {
  FloorplanSymbolEntity,
  FloorplanSymbolGeometry,
  FloorplanSymbolParams,
} from '@/subapps/dxf-viewer/bim/types/floorplan-symbol-types';
import type { BimValidation } from '@/subapps/dxf-viewer/bim/types/bim-base';
import type { IfcPropertySet } from '@/subapps/dxf-viewer/bim/types/ifc-entity-mixin';

export interface CreateFloorplanSymbolInput {
  /** Required: param block. */
  params: FloorplanSymbolParams;
  /** Required: pre-computed geometry cache (caller responsibility). */
  geometry: FloorplanSymbolGeometry;
  /** Required: BaseEntity stable layer id (ADR-358 Phase 9E-6e). */
  layerId: string;
  /** Optional `visible` flag (BaseEntity). Default unset. */
  visible?: boolean;
  /** Optional override (test-only). Default = enterprise floorplan-symbol ID. */
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
 * Produce a new `FloorplanSymbolEntity` with IFC mixin auto-fill. `ifcType`
 * derives from `params.category` (category engine).
 */
export function createFloorplanSymbol(input: CreateFloorplanSymbolInput): FloorplanSymbolEntity {
  const { ifcType } = resolveSymbolCategoryConfig(input.params.category);
  const entity: FloorplanSymbolEntity = {
    id: input.id ?? generateFloorplanSymbolId(),
    type: 'floorplan-symbol',
    kind: input.params.kind,
    layerId: input.layerId,
    params: input.params,
    geometry: input.geometry,
    validation: input.validation ?? makeBimValidation(),
    ifcGuid: input.ifcGuid ?? generateIfcGuid(),
    ifcType,
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
