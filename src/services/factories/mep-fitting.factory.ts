/**
 * MEP Fitting Factory (ADR-408 Φ11).
 *
 * Mirror of `mep-segment.factory.ts`. Pure factory for `MepFittingEntity`
 * (point-based junction element — elbow / coupling / reducer / tee / cross /
 * cap) with IfcEntityMixin auto-population.
 *
 * Auto-populated:
 *   - `id`      : enterprise MEP-fitting ID (`generateMepFittingId`, SOS N.6)
 *   - `ifcGuid` : 22-char IFC4 GlobalId, generated ONCE — never regenerate
 *   - `ifcType` : derived from domain (`IfcPipeFitting` | `IfcDuctFitting`)
 *   - `kind`    : the fitting topology (`params.kind`)
 *   - `validation` : empty `BimValidation` shell unless supplied
 *
 * @see docs/centralized-systems/reference/adrs/ADR-408-mep-connectors-and-systems.md §Φ11
 */

import {
  generateMepFittingId,
  generateIfcGuid,
} from '@/services/enterprise-id-convenience';
import { makeBimValidation } from '@/subapps/dxf-viewer/bim/types/bim-base';
import {
  mepFittingIfcType,
  type MepFittingEntity,
  type MepFittingGeometry,
  type MepFittingParams,
} from '@/subapps/dxf-viewer/bim/types/mep-fitting-types';
import type { BimValidation } from '@/subapps/dxf-viewer/bim/types/bim-base';
import type { IfcPropertySet } from '@/subapps/dxf-viewer/bim/types/ifc-entity-mixin';

export interface CreateMepFittingInput {
  params: MepFittingParams;
  geometry: MepFittingGeometry;
  layerId: string;
  visible?: boolean;
  /** Optional override (test-only). Default = enterprise MEP-fitting ID. */
  id?: string;
  /** Optional override (test-only). Default = generateIfcGuid(). */
  ifcGuid?: string;
  pset?: IfcPropertySet;
  validation?: BimValidation;
  companyId?: string;
  projectId?: string;
  buildingId?: string;
  floorplanId?: string;
  floorId?: string;
  createdBy?: string;
  updatedBy?: string;
}

/** Produce a new `MepFittingEntity` with IFC mixin auto-fill. */
export function createMepFitting(input: CreateMepFittingInput): MepFittingEntity {
  const entity: MepFittingEntity = {
    id: input.id ?? generateMepFittingId(),
    type: 'mep-fitting',
    kind: input.params.kind,
    layerId: input.layerId,
    params: input.params,
    geometry: input.geometry,
    validation: input.validation ?? makeBimValidation(),
    ifcGuid: input.ifcGuid ?? generateIfcGuid(),
    ifcType: mepFittingIfcType(input.params.domain),
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
