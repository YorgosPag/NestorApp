/**
 * BIM Family Types — Effective Param Resolution (SSoT) — ADR-412 §3.4.
 *
 * The heart of ADR-412: resolving the *effective* parameters of a placed BIM
 * instance from its family type. Resolution runs at scene-entity construction
 * time and produces the params the geometry/render pipeline actually consumes.
 *
 * ─── ARCHITECTURE: «type always wins» (locked) ──────────────────────────────
 * The TYPE is the runtime source of truth — exactly the project's MEP idiom
 * («System always wins / persist = drift»). The type-governed fields stored on
 * the instance document are a *drift-tolerant cache*: this resolver OVERWRITES
 * them from the live type, so a stale instance doc can never override the type.
 *
 *   effective = { ...instanceParams, ...type.typeParams, ...instanceOverrides }
 *
 *   - `instanceParams` provide the per-placement fields the type does NOT own
 *     (e.g. wall `start`/`end`/`height`/`flip`).
 *   - `type.typeParams` overwrite the type-governed fields (e.g. wall
 *     `category`/`thickness`/`dna`/`material`) — this is the «type wins» step.
 *   - `instanceOverrides` (per-param overrides) win LAST, letting a single
 *     instance deviate on one type-governed field without detaching the type.
 *
 * ─── LEGACY FAST-PATH = ZERO REGRESSION ─────────────────────────────────────
 * Instances WITHOUT a `typeId` (every wall created before ADR-412) take a fast
 * path that returns their own params untouched — no type, no merge, no behaviour
 * change. The same applies when the type cannot be resolved (`type == null`):
 * we degrade gracefully to the instance's cached params rather than mutating
 * geometry.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-412-bim-family-types.md §3.4
 * @see bim/types/bim-family-type.ts — BimFamilyType / WallTypeParams
 * @see bim/types/wall-types.ts      — WallParams (instance-level superset)
 */

import type {
  BimFamilyType,
  RoofTypeParams,
  SlabTypeParams,
  WallTypeParams,
} from '../types/bim-family-type';
import type { WallParams } from '../types/wall-types';
import type { SlabParams } from '../types/slab-types';
import type { RoofParams } from '../types/roof-types';

/**
 * Generic resolution core — «type always wins, overrides win last».
 *
 * Merge order (later wins): instance `params` → `typeParams` → `overrides`.
 * When `typeParams` is absent the instance params are returned unchanged
 * (legacy fast-path / unresolved type = zero regression).
 *
 * @typeParam P  Full instance param shape (superset, e.g. `WallParams`).
 * @typeParam TP Type-level param subset (e.g. `WallTypeParams`).
 * @param params      Instance params (per-placement + cached type-governed fields).
 * @param typeParams  Type-level params that overwrite the type-governed fields.
 * @param overrides   Per-param overrides that win over both type and instance.
 * @returns The effective params consumed by geometry/render.
 */
export function resolveEffectiveParams<P, TP>(
  params: P,
  typeParams: TP | null | undefined,
  overrides: Partial<TP> | null | undefined,
): P {
  if (!typeParams) return params;
  return { ...params, ...typeParams, ...(overrides ?? {}) } as P;
}

/**
 * Wall convenience wrapper around {@link resolveEffectiveParams}.
 *
 * Returns the instance's own params unchanged when it has no `typeId` (legacy
 * fast-path) or when its type cannot be resolved (`type == null`) — zero
 * regression. Otherwise resolves `category`/`thickness`/`dna`/`material` from
 * the type (type wins), applies any `typeOverrides` last, and preserves all
 * instance-level fields (`start`/`end`/`height`/`flip`/tilt/bindings/…).
 *
 * @param instance Wall instance: cached `params`, optional `typeId`/`typeOverrides`.
 * @param type     The resolved wall family type (or null/undefined if unresolved).
 * @returns The effective `WallParams` for geometry/render.
 */
export function resolveEffectiveWallParams(
  instance: {
    params: WallParams;
    typeId?: string;
    typeOverrides?: Partial<WallTypeParams>;
  },
  type: BimFamilyType<'wall'> | null | undefined,
): WallParams {
  // Legacy fast-path: untyped wall OR unresolved type → unchanged params.
  if (!instance.typeId || !type) return instance.params;
  return resolveEffectiveParams(
    instance.params,
    type.typeParams,
    instance.typeOverrides,
  );
}

/**
 * Slab convenience wrapper around {@link resolveEffectiveParams} — the slab
 * analogue of {@link resolveEffectiveWallParams}.
 *
 * Returns the instance's own params unchanged when it has no `typeId` (legacy
 * fast-path) or when its type cannot be resolved (`type == null`) — zero
 * regression. Otherwise resolves `kind`/`thickness`/`dna`/`material` from the
 * type (type wins), applies any `typeOverrides` last, and preserves all
 * instance-level fields (`outline`/`levelElevation`/`geometryType`/`slope`/…).
 *
 * @param instance Slab instance: cached `params`, optional `typeId`/`typeOverrides`.
 * @param type     The resolved slab family type (or null/undefined if unresolved).
 * @returns The effective `SlabParams` for geometry/render.
 */
export function resolveEffectiveSlabParams(
  instance: {
    params: SlabParams;
    typeId?: string;
    typeOverrides?: Partial<SlabTypeParams>;
  },
  type: BimFamilyType<'slab'> | null | undefined,
): SlabParams {
  // Legacy fast-path: untyped slab OR unresolved type → unchanged params.
  if (!instance.typeId || !type) return instance.params;
  return resolveEffectiveParams(
    instance.params,
    type.typeParams,
    instance.typeOverrides,
  );
}

/**
 * Roof convenience wrapper around {@link resolveEffectiveParams} (ADR-417 §10 #3)
 * — the roof analogue of {@link resolveEffectiveSlabParams}.
 *
 * Returns the instance's own params unchanged when it has no `typeId` (legacy
 * fast-path) or when its type cannot be resolved (`type == null`) — zero
 * regression. Otherwise resolves `thickness`/`dna`/`material` from the type
 * (type wins), applies any `typeOverrides` last, and preserves all per-instance
 * fields (`outline`/`edges`/`slopeUnit`/`basePivotZ`/`sceneUnits`/storey…). A
 * roof has no sub-kind, so the type carries only the build-up + thickness.
 *
 * @param instance Roof instance: cached `params`, optional `typeId`/`typeOverrides`.
 * @param type     The resolved roof family type (or null/undefined if unresolved).
 * @returns The effective `RoofParams` for geometry/render.
 */
export function resolveEffectiveRoofParams(
  instance: {
    params: RoofParams;
    typeId?: string;
    typeOverrides?: Partial<RoofTypeParams>;
  },
  type: BimFamilyType<'roof'> | null | undefined,
): RoofParams {
  // Legacy fast-path: untyped roof OR unresolved type → unchanged params.
  if (!instance.typeId || !type) return instance.params;
  return resolveEffectiveParams(
    instance.params,
    type.typeParams,
    instance.typeOverrides,
  );
}
