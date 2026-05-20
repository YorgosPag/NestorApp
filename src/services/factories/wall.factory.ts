/**
 * Wall Factory (ADR-369 §9 Q5 + Q8) — Phase A3
 *
 * Pure factory function για δημιουργία `WallEntity` με ADR-369 binding
 * defaults + IfcEntityMixin auto-population (ifcGuid + ifcType inference).
 * Δεν γράφει σε Firestore — caller κάνει persist.
 *
 * Auto-populated:
 *   - `id`            : enterprise wall ID (ADR-294 / ADR-363)
 *   - `ifcGuid`       : 22-char IFC4 GlobalId, generated ONCE — never regenerate
 *   - `ifcType`       : 'IfcWallStandardCase' (straight) ή 'IfcWall' (curved/polyline)
 *   - `validation`    : empty `BimValidation` shell
 *   - `baseBinding`   : 'storey-floor' (DEFAULT_WALL_BASE_BINDING)
 *   - `topBinding`    : 'storey-ceiling' (DEFAULT_WALL_TOP_BINDING)
 *   - `baseOffset`/`topOffset` : 0
 *
 * Validation:
 *   - topBinding='unconnected' → unconnectedHeight required (mm > 0), throws αλλιώς.
 *   - topBinding ≠ 'unconnected' με unconnectedHeight set → throws (mutually exclusive).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-369-bim-elevation-convention-revit-alignment.md §9 Q5, Q8
 */

import {
  generateWallId,
  generateIfcGuid,
} from '@/services/enterprise-id-convenience';
import {
  DEFAULT_WALL_BASE_BINDING,
  DEFAULT_WALL_TOP_BINDING,
  type WallBaseBinding,
  type WallTopBinding,
} from '@/subapps/dxf-viewer/bim/types/bim-binding';
import { makeBimValidation } from '@/subapps/dxf-viewer/bim/types/bim-base';
import type {
  WallEntity,
  WallParams,
  WallGeometry,
  WallKind,
} from '@/subapps/dxf-viewer/bim/types/wall-types';
import type { BimValidation, BimQuantityTakeoff } from '@/subapps/dxf-viewer/bim/types/bim-base';
import type { IfcPropertySet } from '@/subapps/dxf-viewer/bim/types/ifc-entity-mixin';

/** WallParams χωρίς τα ADR-369 binding fields (factory τα γεμίζει με defaults). */
type WallParamsCallerInput = Omit<
  WallParams,
  'baseBinding' | 'topBinding' | 'baseOffset' | 'topOffset'
> & {
  baseBinding?: WallBaseBinding;
  topBinding?: WallTopBinding;
  baseOffset?: number;
  topOffset?: number;
  /** Override allowed — defaults to undefined unless topBinding='unconnected'. */
  unconnectedHeight?: number;
};

export interface CreateWallInput {
  /** Required: wall sub-type (straight | curved | polyline). */
  kind: WallKind;
  /** Required: param block (binding fields optional — factory fills defaults). */
  params: WallParamsCallerInput;
  /** Required: pre-computed geometry cache (caller responsibility). */
  geometry: WallGeometry;
  /** Required: BaseEntity stable layer id (ADR-358 Phase 9E-6e). */
  layerId: string;
  /** Optional `visible` flag (BaseEntity). Default unset (undefined). */
  visible?: boolean;
  /** Optional override (test-only). Default = enterprise wall ID. */
  id?: string;
  /** Optional override (test-only). Default = generateIfcGuid(). */
  ifcGuid?: string;
  /** Optional sparse IFC Property Sets payload. */
  pset?: IfcPropertySet;
  /** Optional validation block. Default = empty BimValidation. */
  validation?: BimValidation;
  /** Optional QTO block. */
  qto?: BimQuantityTakeoff;
  /** Optional back-ref για render + QTO subtraction. */
  hostedOpeningIds?: readonly string[];
  /** Optional tenant fields — pass-through to caller. */
  companyId?: string;
  projectId?: string;
  buildingId?: string;
  floorplanId?: string;
  floorId?: string;
  createdBy?: string;
  updatedBy?: string;
}

/** Infer IFC4 class από WallKind. Straight → IfcWallStandardCase, αλλιώς IfcWall. */
export function inferWallIfcType(kind: WallKind): 'IfcWall' | 'IfcWallStandardCase' {
  return kind === 'straight' ? 'IfcWallStandardCase' : 'IfcWall';
}

function resolveWallParams(input: WallParamsCallerInput): WallParams {
  const topBinding = input.topBinding ?? DEFAULT_WALL_TOP_BINDING;
  if (topBinding === 'unconnected' && input.unconnectedHeight === undefined) {
    throw new Error(
      "createWall: topBinding='unconnected' απαιτεί unconnectedHeight (mm > 0).",
    );
  }
  if (topBinding !== 'unconnected' && input.unconnectedHeight !== undefined) {
    throw new Error(
      "createWall: unconnectedHeight επιτρέπεται μόνο όταν topBinding='unconnected'.",
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
    baseBinding: input.baseBinding ?? DEFAULT_WALL_BASE_BINDING,
    topBinding,
    baseOffset: input.baseOffset ?? 0,
    topOffset: input.topOffset ?? 0,
    offsetFromStorey: input.offsetFromStorey ?? 0,
  };
}

/**
 * Παράγει νέο `WallEntity` με ADR-369 binding defaults + IFC mixin auto-fill.
 *
 * @throws Error αν topBinding='unconnected' χωρίς unconnectedHeight ή vice versa.
 *
 * @example
 * createWall({ kind: 'straight', params: { category:'interior', start, end, height:3000,
 *   thickness:200, flip:false }, geometry });
 * // → ifcType='IfcWallStandardCase', baseBinding='storey-floor', topBinding='storey-ceiling'
 */
export function createWall(input: CreateWallInput): WallEntity {
  const params = resolveWallParams(input.params);
  const entity: WallEntity = {
    id: input.id ?? generateWallId(),
    type: 'wall',
    kind: input.kind,
    layerId: input.layerId,
    params,
    geometry: input.geometry,
    validation: input.validation ?? makeBimValidation(),
    ifcGuid: input.ifcGuid ?? generateIfcGuid(),
    ifcType: inferWallIfcType(input.kind),
    ...(input.visible !== undefined && { visible: input.visible }),
    ...(input.pset !== undefined && { pset: input.pset }),
    ...(input.qto !== undefined && { qto: input.qto }),
    ...(input.hostedOpeningIds !== undefined && {
      hostedOpeningIds: input.hostedOpeningIds,
    }),
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
