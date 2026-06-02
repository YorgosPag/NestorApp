/**
 * Railing Factory (ADR-407).
 *
 * Mirror of `mep-fixture.factory.ts`. Pure factory for `RailingEntity` with
 * IfcEntityMixin auto-population.
 *
 * Auto-populated:
 *   - `id`      : enterprise railing ID (`generateRailingId`, SOS N.6)
 *   - `ifcGuid` : 22-char IFC4 GlobalId, generated ONCE — never regenerate
 *   - `ifcType` : 'IfcRailing'
 *   - `kind`    : always 'railing' (PredefinedType lives on the Type)
 *   - `validation` : empty `BimValidation` shell unless supplied
 *
 * @see docs/centralized-systems/reference/adrs/ADR-407-bim-railings.md
 */

import {
  generateRailingId,
  generateIfcGuid,
} from '@/services/enterprise-id-convenience';
import { makeBimValidation } from '@/subapps/dxf-viewer/bim/types/bim-base';
import type {
  RailingEntity,
  RailingGeometry,
  RailingParams,
} from '@/subapps/dxf-viewer/bim/types/railing-types';
import type { BimValidation } from '@/subapps/dxf-viewer/bim/types/bim-base';
import type { IfcPropertySet } from '@/subapps/dxf-viewer/bim/types/ifc-entity-mixin';

export interface CreateRailingInput {
  /** Required: param block (Type + path + heights). */
  params: RailingParams;
  /** Required: pre-computed geometry cache (caller responsibility). */
  geometry: RailingGeometry;
  /** Required: BaseEntity stable layer id. */
  layerId: string;
  /** Optional `visible` flag (BaseEntity). Default unset. */
  visible?: boolean;
  /** Optional override (test-only). Default = enterprise railing ID. */
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
 * Produce a new `RailingEntity` with IFC mixin auto-fill.
 *
 * @example
 * createRailing({ params: { type: DEFAULT_RAILING_TYPE,
 *   pathSource: { kind: 'sketch', path }, totalHeightMm: 1000,
 *   baseElevationMm: 0 }, geometry, layerId });
 */
export function createRailing(input: CreateRailingInput): RailingEntity {
  const entity: RailingEntity = {
    id: input.id ?? generateRailingId(),
    type: 'railing',
    kind: 'railing',
    layerId: input.layerId,
    params: input.params,
    geometry: input.geometry,
    validation: input.validation ?? makeBimValidation(),
    ifcGuid: input.ifcGuid ?? generateIfcGuid(),
    ifcType: 'IfcRailing',
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
