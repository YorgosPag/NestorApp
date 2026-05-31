/**
 * ADR-363 Phase 1B — Wall param read/patch helpers.
 *
 * Pure functions bridging `WALL_RIBBON_KEYS` ↔ `WallParams`. Mirrors
 * `stair-param-helpers.ts` (ADR-358 §7a) — bridge dispatches via
 * `UpdateWallParamsCommand` with the patched params, command recomputes
 * geometry + validation through SSoT (`computeWallGeometry`,
 * `validateWallParams`).
 *
 * Numeric I/O is normalized to mm: the ribbon combobox values are mm strings
 * ('2400', '3000', ...). When scene units differ from mm, the bridge applies
 * `* scale` on write and `/ scale` on read so the hardcoded option lists
 * always line up with the displayed current value (mirrors stair Phase 9).
 *
 * Phase 1B writable surface: `category` + `height` + `thickness` + `flip`.
 * DNA editor + advanced overrides land Phase 1.5.
 */

import type { WallCategory, WallParams } from '../../../../bim/types/wall-types';
import { WALL_RIBBON_KEYS } from './wall-command-keys';
import {
  readEnvelopeFunctionValue,
  parseEnvelopeFunctionValue,
} from './envelope-function-param';

const VALID_CATEGORIES: ReadonlySet<WallCategory> = new Set<WallCategory>([
  'exterior',
  'interior',
  'partition',
  'parapet',
  'fence',
]);

export interface WallPatchContext {
  /** mm → scene-units conversion factor (e.g. `1` for mm scenes, `0.001` for metres). */
  readonly scale: number;
}

// ─── String reads/writes ────────────────────────────────────────────────────

export function readWallStringField(
  commandKey: string,
  params: WallParams,
): string | null {
  if (commandKey === WALL_RIBBON_KEYS.stringParams.category) {
    return params.category;
  }
  if (commandKey === WALL_RIBBON_KEYS.toggles.flip) {
    return params.flip ? 'true' : 'false';
  }
  if (commandKey === WALL_RIBBON_KEYS.stringParams.material) {
    return params.material ?? null;
  }
  // ADR-396 v2 Φ6a — ETICS override: undefined (απών) → 'auto' sentinel.
  if (commandKey === WALL_RIBBON_KEYS.stringParams.envelopeFunction) {
    return readEnvelopeFunctionValue(params.envelopeFunction);
  }
  return null;
}

export function patchWallStringParam(
  params: WallParams,
  commandKey: string,
  value: string,
): WallParams | null {
  if (commandKey === WALL_RIBBON_KEYS.stringParams.category) {
    const category = value as WallCategory;
    if (!VALID_CATEGORIES.has(category)) return null;
    return { ...params, category };
  }
  if (commandKey === WALL_RIBBON_KEYS.toggles.flip) {
    if (value !== 'true' && value !== 'false') return null;
    return { ...params, flip: value === 'true' };
  }
  if (commandKey === WALL_RIBBON_KEYS.stringParams.material) {
    return { ...params, material: value || undefined };
  }
  // ADR-396 v2 Φ6a — ETICS override: 'auto' → clear (undefined)· άκυρη τιμή → no-op.
  if (commandKey === WALL_RIBBON_KEYS.stringParams.envelopeFunction) {
    const parsed = parseEnvelopeFunctionValue(value);
    if (!parsed) return null;
    return { ...params, envelopeFunction: parsed.fn };
  }
  return null;
}

// ─── Numeric reads/writes ───────────────────────────────────────────────────

/**
 * Numeric field read — returns the value in **mm** so the bridge can compare
 * against the hardcoded mm combobox options. Scene-unit conversion is applied
 * inside the helper.
 */
export function readWallNumericField(
  commandKey: string,
  params: WallParams,
  scale: number,
): string | null {
  if (commandKey === WALL_RIBBON_KEYS.params.height) {
    return String(Math.round(params.height / scale));
  }
  if (commandKey === WALL_RIBBON_KEYS.params.thickness) {
    return String(Math.round(params.thickness / scale));
  }
  return null;
}

/**
 * Numeric field write — accepts a value in **mm** (combobox option). The bridge
 * scales mm → scene units before patching. `category` is unchanged so DNA
 * reconciliation stays the validator's responsibility (manual override path).
 */
export function patchWallNumericParam(
  params: WallParams,
  commandKey: string,
  mmValue: number,
  ctx: WallPatchContext,
): WallParams | null {
  if (commandKey === WALL_RIBBON_KEYS.params.height) {
    if (!Number.isFinite(mmValue) || mmValue <= 0) return null;
    return { ...params, height: mmValue * ctx.scale };
  }
  if (commandKey === WALL_RIBBON_KEYS.params.thickness) {
    if (!Number.isFinite(mmValue) || mmValue <= 0) return null;
    // Manual thickness override drops DNA composition (`dna` field) per
    // wall-completion.ts contract — DNA totalThickness invariant is enforced
    // by the validator; clearing dna avoids hardError(`dnaThicknessMismatch`).
    return { ...params, thickness: mmValue * ctx.scale, dna: undefined };
  }
  return null;
}
