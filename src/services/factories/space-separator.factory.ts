/**
 * Space Separator Factory (ADR-437).
 *
 * Pure factory για δημιουργία `SpaceSeparatorEntity` με IfcEntityMixin auto-population
 * (ifcGuid + ifcType='IfcVirtualElement'). Δεν γράφει σε Firestore — caller κάνει persist.
 *
 * Auto-populated:
 *   - `id`         : enterprise space-separator ID (prefix 'ssp', N.6)
 *   - `kind`       : SpaceSeparatorKind ('room-bounding')
 *   - `ifcGuid`    : 22-char IFC4 GlobalId, generated ONCE — never regenerate
 *   - `ifcType`    : 'IfcVirtualElement' (πάντα — virtual boundary)
 *   - `validation` : empty `BimValidation` shell (ή caller-supplied)
 *
 * @see bim/types/space-separator-types.ts
 * @see src/services/factories/thermal-space.factory.ts — το πρότυπο (L0 entity)
 */

import {
  generateSpaceSeparatorId,
  generateIfcGuid,
} from '@/services/enterprise-id-convenience';
import type {
  SpaceSeparatorEntity,
  SpaceSeparatorGeometry,
  SpaceSeparatorKind,
  SpaceSeparatorParams,
} from '@/subapps/dxf-viewer/bim/types/space-separator-types';
import { DEFAULT_SPACE_SEPARATOR_KIND } from '@/subapps/dxf-viewer/bim/types/space-separator-types';
import { makeBimValidation } from '@/subapps/dxf-viewer/bim/types/bim-base';
import type { BimValidation } from '@/subapps/dxf-viewer/bim/types/bim-base';
import type { IfcPropertySet } from '@/subapps/dxf-viewer/bim/types/ifc-entity-mixin';

export interface CreateSpaceSeparatorInput {
  /** Required: param block (start + end + optional name). */
  params: SpaceSeparatorParams;
  /** Required: pre-computed geometry cache (caller responsibility). */
  geometry: SpaceSeparatorGeometry;
  /** Required: BaseEntity stable layer id. */
  layerId: string;
  /** Optional discriminator. Default = 'room-bounding'. */
  kind?: SpaceSeparatorKind;
  /** Optional `visible` flag (BaseEntity). Default unset. */
  visible?: boolean;
  /** Optional override (test-only). Default = enterprise space-separator ID. */
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
 * Παράγει νέο `SpaceSeparatorEntity` με IFC mixin auto-fill.
 *
 * @example
 * createSpaceSeparator({ params: { start, end }, geometry, layerId:'lyr_x' });
 *   // → ifcType='IfcVirtualElement', kind='room-bounding'
 */
export function createSpaceSeparator(input: CreateSpaceSeparatorInput): SpaceSeparatorEntity {
  const entity: SpaceSeparatorEntity = {
    id: input.id ?? generateSpaceSeparatorId(),
    type: 'space-separator',
    kind: input.kind ?? DEFAULT_SPACE_SEPARATOR_KIND,
    layerId: input.layerId,
    params: input.params,
    geometry: input.geometry,
    validation: input.validation ?? makeBimValidation(),
    ifcGuid: input.ifcGuid ?? generateIfcGuid(),
    ifcType: 'IfcVirtualElement',
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
