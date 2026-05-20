/**
 * Column Factory (ADR-369 §9 Q5 + Q8) — Phase A3
 *
 * Mirror του wall.factory.ts. Pure factory function για `ColumnEntity` με
 * ADR-369 binding defaults + IfcEntityMixin auto-population.
 *
 * Auto-populated:
 *   - `id`            : enterprise column ID (ADR-294 / ADR-363)
 *   - `ifcGuid`       : 22-char IFC4 GlobalId, generated ONCE — never regenerate
 *   - `ifcType`       : 'IfcColumn' (πάντα — όλα τα 4 ColumnKinds map σε IfcColumn)
 *   - `validation`    : empty `BimValidation` shell
 *   - `baseBinding`   : 'storey-floor' (DEFAULT_COLUMN_BASE_BINDING)
 *   - `topBinding`    : 'storey-ceiling' (DEFAULT_COLUMN_TOP_BINDING)
 *   - `baseOffset`/`topOffset` : 0
 *
 * Validation:
 *   - topBinding='unconnected' → unconnectedHeight required (mm > 0), throws αλλιώς.
 *   - topBinding ≠ 'unconnected' με unconnectedHeight set → throws (mutually exclusive).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-369-bim-elevation-convention-revit-alignment.md §9 Q5, Q8
 */

import {
  generateColumnId,
  generateIfcGuid,
} from '@/services/enterprise-id-convenience';
import {
  DEFAULT_COLUMN_BASE_BINDING,
  DEFAULT_COLUMN_TOP_BINDING,
  type ColumnBaseBinding,
  type ColumnTopBinding,
} from '@/subapps/dxf-viewer/bim/types/bim-binding';
import { makeBimValidation } from '@/subapps/dxf-viewer/bim/types/bim-base';
import type {
  ColumnEntity,
  ColumnParams,
  ColumnGeometry,
  ColumnKind,
} from '@/subapps/dxf-viewer/bim/types/column-types';
import type { BimValidation, BimQuantityTakeoff } from '@/subapps/dxf-viewer/bim/types/bim-base';
import type { IfcPropertySet } from '@/subapps/dxf-viewer/bim/types/ifc-entity-mixin';

type ColumnParamsCallerInput = Omit<
  ColumnParams,
  'baseBinding' | 'topBinding' | 'baseOffset' | 'topOffset'
> & {
  baseBinding?: ColumnBaseBinding;
  topBinding?: ColumnTopBinding;
  baseOffset?: number;
  topOffset?: number;
  unconnectedHeight?: number;
};

export interface CreateColumnInput {
  /** Required: param block (binding fields optional — factory fills defaults). */
  params: ColumnParamsCallerInput;
  /** Required: pre-computed geometry cache (caller responsibility). */
  geometry: ColumnGeometry;
  /** Required: BaseEntity stable layer id (ADR-358 Phase 9E-6e). */
  layerId: string;
  /** Optional `visible` flag (BaseEntity). Default unset. */
  visible?: boolean;
  /** Optional override (test-only). Default = enterprise column ID. */
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

function resolveColumnParams(input: ColumnParamsCallerInput): ColumnParams {
  const topBinding = input.topBinding ?? DEFAULT_COLUMN_TOP_BINDING;
  if (topBinding === 'unconnected' && input.unconnectedHeight === undefined) {
    throw new Error(
      "createColumn: topBinding='unconnected' απαιτεί unconnectedHeight (mm > 0).",
    );
  }
  if (topBinding !== 'unconnected' && input.unconnectedHeight !== undefined) {
    throw new Error(
      "createColumn: unconnectedHeight επιτρέπεται μόνο όταν topBinding='unconnected'.",
    );
  }
  const {
    baseBinding: _bb,
    topBinding: _tb,
    baseOffset: _bo,
    topOffset: _to,
    ...rest
  } = input;
  void _bb;
  void _tb;
  void _bo;
  void _to;
  return {
    ...rest,
    baseBinding: input.baseBinding ?? DEFAULT_COLUMN_BASE_BINDING,
    topBinding,
    baseOffset: input.baseOffset ?? 0,
    topOffset: input.topOffset ?? 0,
  };
}

/**
 * Παράγει νέο `ColumnEntity` με ADR-369 binding defaults + IFC mixin auto-fill.
 *
 * @throws Error αν topBinding='unconnected' χωρίς unconnectedHeight ή vice versa.
 *
 * @example
 * createColumn({ params: { kind:'rectangular', position, anchor:'center',
 *   width:400, depth:400, height:3000, rotation:0 }, geometry });
 * // → ifcType='IfcColumn', baseBinding='storey-floor', topBinding='storey-ceiling'
 */
export function createColumn(input: CreateColumnInput): ColumnEntity {
  const params = resolveColumnParams(input.params);
  const entity: ColumnEntity = {
    id: input.id ?? generateColumnId(),
    type: 'column',
    kind: params.kind,
    layerId: input.layerId,
    params,
    geometry: input.geometry,
    validation: input.validation ?? makeBimValidation(),
    ifcGuid: input.ifcGuid ?? generateIfcGuid(),
    ifcType: 'IfcColumn',
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

// Re-export ColumnKind for caller convenience (test ergonomics).
export type { ColumnKind };
