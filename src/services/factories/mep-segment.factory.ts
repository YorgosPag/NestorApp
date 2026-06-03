/**
 * MEP Segment Factory (ADR-408 Φ8).
 *
 * Mirror of `electrical-panel.factory.ts`. Pure factory for `MepSegmentEntity`
 * (unified duct/pipe linear element) with IfcEntityMixin auto-population.
 *
 * Auto-populated:
 *   - `id`      : enterprise MEP-segment ID (`generateMepSegmentId`, SOS N.6)
 *   - `ifcGuid` : 22-char IFC4 GlobalId, generated ONCE — never regenerate
 *   - `ifcType` : derived from domain (`IfcDuctSegment` | `IfcPipeSegment`)
 *   - `kind`    : the segment domain (`'duct'` | `'pipe'`)
 *   - `validation` : empty `BimValidation` shell unless supplied
 *
 * @see docs/centralized-systems/reference/adrs/ADR-408-mep-connectors-and-systems.md §Φ8
 */

import {
  generateMepSegmentId,
  generateIfcGuid,
} from '@/services/enterprise-id-convenience';
import { makeBimValidation } from '@/subapps/dxf-viewer/bim/types/bim-base';
import {
  mepSegmentIfcType,
  type MepSegmentEntity,
  type MepSegmentGeometry,
  type MepSegmentParams,
} from '@/subapps/dxf-viewer/bim/types/mep-segment-types';
import type { BimValidation } from '@/subapps/dxf-viewer/bim/types/bim-base';
import type { IfcPropertySet } from '@/subapps/dxf-viewer/bim/types/ifc-entity-mixin';

export interface CreateMepSegmentInput {
  params: MepSegmentParams;
  geometry: MepSegmentGeometry;
  layerId: string;
  visible?: boolean;
  /** Optional override (test-only). Default = enterprise MEP-segment ID. */
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

/** Produce a new `MepSegmentEntity` with IFC mixin auto-fill. */
export function createMepSegment(input: CreateMepSegmentInput): MepSegmentEntity {
  const entity: MepSegmentEntity = {
    id: input.id ?? generateMepSegmentId(),
    type: 'mep-segment',
    kind: input.params.domain,
    layerId: input.layerId,
    params: input.params,
    geometry: input.geometry,
    validation: input.validation ?? makeBimValidation(),
    ifcGuid: input.ifcGuid ?? generateIfcGuid(),
    ifcType: mepSegmentIfcType(input.params.domain),
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
