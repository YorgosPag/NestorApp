/**
 * BIM binding-params resolver (ADR-592) — shared SSoT for wall/column factories.
 *
 * `resolveWallParams` and `resolveColumnParams` carried a byte-identical ADR-369
 * binding block: validate `unconnectedHeight` against `topBinding`, then strip the
 * four optional binding fields and re-apply their defaults. Column bindings are a
 * type alias of wall bindings (`ColumnBaseBinding = WallBaseBinding`), so one
 * generic resolver serves both.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-592-bim-entity-factory-base-ssot.md
 */

import {
  DEFAULT_WALL_BASE_BINDING,
  DEFAULT_WALL_TOP_BINDING,
  type WallBaseBinding,
  type WallTopBinding,
} from '@/subapps/dxf-viewer/bim/types/bim-binding';

/** Optional binding fields a caller may override before defaults are applied. */
export interface BindableParamsInput {
  baseBinding?: WallBaseBinding;
  topBinding?: WallTopBinding;
  baseOffset?: number;
  topOffset?: number;
  unconnectedHeight?: number;
  offsetFromStorey?: number;
}

/** The four binding fields + `offsetFromStorey` after defaults are applied. */
export interface ResolvedBindingParams {
  baseBinding: WallBaseBinding;
  topBinding: WallTopBinding;
  baseOffset: number;
  topOffset: number;
  offsetFromStorey: number;
}

/**
 * Validate + resolve ADR-369 binding defaults. `label` prefixes the thrown
 * developer-error message (e.g. `'createWall'`). Preserves every non-binding
 * field of the caller input.
 */
export function resolveBindingParams<TInput extends BindableParamsInput>(
  input: TInput,
  label: string,
): Omit<TInput, keyof ResolvedBindingParams> & ResolvedBindingParams {
  const topBinding = input.topBinding ?? DEFAULT_WALL_TOP_BINDING;
  if (topBinding === 'unconnected' && input.unconnectedHeight === undefined) {
    throw new Error(`${label}: topBinding='unconnected' requires unconnectedHeight (mm > 0).`);
  }
  if (topBinding !== 'unconnected' && input.unconnectedHeight !== undefined) {
    throw new Error(`${label}: unconnectedHeight is only allowed when topBinding='unconnected'.`);
  }
  const { baseBinding: _bb, topBinding: _tb, baseOffset: _bo, topOffset: _to, ...rest } = input;
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
