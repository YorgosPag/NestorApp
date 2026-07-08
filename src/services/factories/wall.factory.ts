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

import { generateWallId } from '@/services/enterprise-id-convenience';
import {
  type WallBaseBinding,
  type WallTopBinding,
} from '@/subapps/dxf-viewer/bim/types/bim-binding';
import type {
  WallEntity,
  WallParams,
  WallGeometry,
  WallKind,
} from '@/subapps/dxf-viewer/bim/types/wall-types';
import {
  type CreateBimEntityInputBase,
  assembleBimEntity,
} from '@/services/factories/bim-entity-factory-base';
import { resolveBindingParams } from '@/services/factories/bim-binding-params';

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

export interface CreateWallInput extends CreateBimEntityInputBase {
  /** Required: wall sub-type (straight | curved | polyline). */
  kind: WallKind;
  /** Required: param block (binding fields optional — factory fills defaults). */
  params: WallParamsCallerInput;
  /** Required: pre-computed geometry cache (caller responsibility). */
  geometry: WallGeometry;
  /** Optional back-ref για render + QTO subtraction. */
  hostedOpeningIds?: readonly string[];
}

/** Infer IFC4 class από WallKind. Straight → IfcWallStandardCase, αλλιώς IfcWall. */
export function inferWallIfcType(kind: WallKind): 'IfcWall' | 'IfcWallStandardCase' {
  return kind === 'straight' ? 'IfcWallStandardCase' : 'IfcWall';
}

function resolveWallParams(input: WallParamsCallerInput): WallParams {
  return resolveBindingParams(input, 'createWall');
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
  return {
    ...assembleBimEntity(
      {
        type: 'wall',
        kind: input.kind,
        layerId: input.layerId,
        params,
        geometry: input.geometry,
        ifcType: inferWallIfcType(input.kind),
        generateId: generateWallId,
      },
      input,
    ),
    ...(input.hostedOpeningIds !== undefined && {
      hostedOpeningIds: input.hostedOpeningIds,
    }),
  };
}
