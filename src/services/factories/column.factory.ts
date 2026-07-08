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

import { generateColumnId } from '@/services/enterprise-id-convenience';
import {
  type ColumnBaseBinding,
  type ColumnTopBinding,
} from '@/subapps/dxf-viewer/bim/types/bim-binding';
import type {
  ColumnEntity,
  ColumnParams,
  ColumnGeometry,
  ColumnKind,
} from '@/subapps/dxf-viewer/bim/types/column-types';
import {
  type CreateBimEntityInputBase,
  assembleBimEntity,
} from '@/services/factories/bim-entity-factory-base';
import { resolveBindingParams } from '@/services/factories/bim-binding-params';

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

export interface CreateColumnInput extends CreateBimEntityInputBase {
  /** Required: param block (binding fields optional — factory fills defaults). */
  params: ColumnParamsCallerInput;
  /** Required: pre-computed geometry cache (caller responsibility). */
  geometry: ColumnGeometry;
}

function resolveColumnParams(input: ColumnParamsCallerInput): ColumnParams {
  return resolveBindingParams(input, 'createColumn');
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
  return assembleBimEntity(
    {
      type: 'column',
      kind: params.kind,
      layerId: input.layerId,
      params,
      geometry: input.geometry,
      ifcType: 'IfcColumn',
      generateId: generateColumnId,
    },
    input,
  );
}

// Re-export ColumnKind for caller convenience (test ergonomics).
export type { ColumnKind };
