/**
 * Underfloor (radiant floor) Heating Loop Factory (ADR-408 Εύρος Β #3).
 *
 * Mirror of `mep-boiler.factory.ts` for the AREA-based `MepUnderfloorEntity`. Pure
 * factory with IfcEntityMixin auto-population. Unlike the point-based hosts the
 * underfloor entity has NO `position`/`rotation`; its footprint polygon IS the entity.
 *
 * Auto-populated:
 *   - `id`      : enterprise underfloor ID (`generateMepUnderfloorId`, prefix `uhf`, SOS N.6)
 *   - `ifcGuid` : 22-char IFC4 GlobalId, generated ONCE — never regenerate
 *   - `ifcType` : 'IfcSpaceHeater'
 *   - `validation` : empty `BimValidation` shell unless supplied
 *
 * @see docs/centralized-systems/reference/adrs/ADR-408-mep-connectors-and-systems.md
 */

import {
  generateMepUnderfloorId,
  generateIfcGuid,
} from '@/services/enterprise-id-convenience';
import { makeBimValidation } from '@/subapps/dxf-viewer/bim/types/bim-base';
import type {
  MepUnderfloorEntity,
  MepUnderfloorGeometry,
  MepUnderfloorParams,
} from '@/subapps/dxf-viewer/bim/types/mep-underfloor-types';
import type { BimValidation } from '@/subapps/dxf-viewer/bim/types/bim-base';
import type { IfcPropertySet } from '@/subapps/dxf-viewer/bim/types/ifc-entity-mixin';

export interface CreateMepUnderfloorInput {
  /** Required: param block (footprint + serpentine params + connectors). */
  params: MepUnderfloorParams;
  /** Required: pre-computed geometry cache (caller responsibility). */
  geometry: MepUnderfloorGeometry;
  /** Required: BaseEntity stable layer id. */
  layerId: string;
  /** Optional `visible` flag (BaseEntity). Default unset. */
  visible?: boolean;
  /** Optional override (test-only). Default = enterprise underfloor ID. */
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
 * Produce a new `MepUnderfloorEntity` with IFC mixin auto-fill.
 */
export function createMepUnderfloor(input: CreateMepUnderfloorInput): MepUnderfloorEntity {
  const entity: MepUnderfloorEntity = {
    id: input.id ?? generateMepUnderfloorId(),
    type: 'mep-underfloor',
    kind: input.params.kind,
    layerId: input.layerId,
    params: input.params,
    geometry: input.geometry,
    validation: input.validation ?? makeBimValidation(),
    ifcGuid: input.ifcGuid ?? generateIfcGuid(),
    ifcType: 'IfcSpaceHeater',
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
