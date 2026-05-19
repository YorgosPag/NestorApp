/**
 * ADR-358 Phase 7a / 9 / 9B-1 — Pure read/patch helpers for the stair ribbon
 * bridge. Extracted from `useRibbonStairBridge` (Phase 9B-1) to keep the hook
 * file under the 500-line SRP limit.
 *
 * Moved from `ui/ribbon/hooks/bridge/` → `bim/hooks/bridge/` (ADR-363 R2)
 * to resolve cross-domain coupling: BIM hooks MUST NOT import from UI/ribbon.
 */

import {
  isStairKind,
  type StairKind,
  type StairMultiStoryConfig,
  type StairNokSubType,
  type StairNosingSide,
  type StairParams,
  type StairRiserType,
  type StairStructureType,
  type StairTurnDirectionLR,
  type StairWinderMethod,
} from '../../types/stair-types';
import {
  STAIR_RIBBON_KEYS,
  type StairRibbonComboKey,
  type StairRibbonStringComboKey,
} from './stair-command-keys';
import {
  deriveRiseFromStepCount,
  mmFactorFromWidth,
  reconcileLinkedStair,
} from '../../stairs/stair-floor-link';
import {
  buildDefaultVariantFor,
  buildLShapeWindersVariant,
  splitTwoFlightsForWinders,
} from '../../stairs/stair-variant-defaults';

// ── Module-private constants ─────────────────────────────────────────────────

const OPEN_RISER_STRUCTURE_TYPES: ReadonlySet<StairStructureType> = new Set<StairStructureType>([
  'cantilever',
  'suspended',
  'glass-tread',
  'steel-grating',
]);

const SIDE_NOSING_STRUCTURE_TYPES: ReadonlySet<StairStructureType> = new Set<StairStructureType>([
  'cantilever',
  'glass-tread',
  'steel-grating',
]);

const VALID_STRUCTURE_TYPES: ReadonlySet<string> = new Set<string>([
  'monolithic',
  'stringer-1side',
  'stringer-2side',
  'central-stringer',
  'cantilever',
  'suspended',
  'glass-tread',
  'steel-grating',
]);

const DEFAULT_STORY_HEIGHT_MM = 2700;

/**
 * ADR-358 Phase 3g — NOK stair scope ∈ Κτιριοδομικός Άρθρο 13 παρ. 2-4.
 * Legacy `'secondary'` is accepted at read-time for forward compat but the
 * patch helper rewrites it to `'low-rise'`.
 */
const VALID_NOK_SUB_TYPES: ReadonlySet<string> = new Set<string>([
  'main',
  'low-rise',
  'internal',
  'auxiliary',
  'secondary',
]);

// ── Context type ─────────────────────────────────────────────────────────────

/**
 * ADR-358 Phase 9B-1 — context passed to numeric patch helpers. `scale` is the
 * mm→scene-unit factor; `buildingTotalFloors` / `currentFloorNumber` enable
 * domain-aware clamping in `patchStoryCount`.
 */
export interface StairPatchContext {
  readonly scale: number;
  readonly buildingTotalFloors: number;
  readonly currentFloorNumber: number | null;
}

// ── Read helpers ─────────────────────────────────────────────────────────────

export function readStairStringField(
  key: StairRibbonStringComboKey,
  p: StairParams,
): string | null {
  switch (key) {
    case STAIR_RIBBON_KEYS.stringParams.structureType: return p.structureType;
    case STAIR_RIBBON_KEYS.stringParams.riserType:     return p.riserType;
    case STAIR_RIBBON_KEYS.stringParams.flight2TurnDirection:
      return readFlightTurnDirection(p, 0);
    case STAIR_RIBBON_KEYS.stringParams.flight3TurnDirection:
      return readFlightTurnDirection(p, 1);
    case STAIR_RIBBON_KEYS.stringParams.variantKind:
      return p.variant.kind;
    case STAIR_RIBBON_KEYS.stringParams.cornerStyle:
      return p.variant.kind === 'l-shape' ? p.variant.cornerStyle : null;
    case STAIR_RIBBON_KEYS.stringParams.winderMethod:
      return p.variant.kind === 'l-shape' && p.variant.cornerStyle === 'winders'
        ? p.variant.winderMethod
        : null;
    case STAIR_RIBBON_KEYS.stringParams.nokSubType:
      // Legacy `'secondary'` shown as `'low-rise'` (hydration alias). Default
      // to `'main'` for non-NOK profiles so the combobox renders a stable
      // value (validator gates downstream on `codeProfile === 'nok'` anyway).
      return p.nokSubType === 'secondary' ? 'low-rise' : (p.nokSubType ?? 'main');
    default: return null;
  }
}

/**
 * ADR-358 Phase 7b2b-β Stream F — read flight turn direction from variant.
 * `flightIndex` 0 → flight 2 (l-shape/u-shape `turnDirection`, gamma `turnSequence[0]`).
 * `flightIndex` 1 → flight 3 (gamma only, `turnSequence[1]`).
 */
function readFlightTurnDirection(p: StairParams, flightIndex: 0 | 1): string | null {
  const v = p.variant;
  if (flightIndex === 0) {
    if (v.kind === 'l-shape' || v.kind === 'u-shape') return v.turnDirection;
    if (v.kind === 'gamma') return v.turnSequence[0];
    return null;
  }
  if (v.kind === 'gamma') return v.turnSequence[1];
  return null;
}

export function readStairNumericField(
  key: StairRibbonComboKey,
  p: StairParams,
  scale: number,
): string | null {
  // ADR-358 Phase 9 — convert scene-unit-stored geometry params back to mm
  // for the ribbon. `scale = mmToSceneUnits(currentUnits)`. Rounding to the
  // nearest integer mm keeps the combobox value matching the static option
  // strings (140/150/175…) without floating-point drift on m scenes.
  const toMm = (v: number): string => String(Math.round(v / scale));
  switch (key) {
    case STAIR_RIBBON_KEYS.params.rise:        return toMm(p.rise);
    case STAIR_RIBBON_KEYS.params.tread:       return toMm(p.tread);
    case STAIR_RIBBON_KEYS.params.width:       return toMm(p.width);
    case STAIR_RIBBON_KEYS.params.stepCount:   return String(p.stepCount);
    // Return `null` (not `''`) when multi-story config is absent — Radix Select
    // forbids empty-string SelectItem values and RibbonCombobox injects the
    // current value as a fallback option. Empty-string would crash the panel
    // on stair selection (regression observed 2026-05-17).
    case STAIR_RIBBON_KEYS.params.storyCount:  return p.multiStoryConfig ? String(p.multiStoryConfig.storyCount) : null;
    // storyHeight stays in mm in StairMultiStoryConfig (Phase 7a contract).
    case STAIR_RIBBON_KEYS.params.storyHeight: return p.multiStoryConfig ? String(p.multiStoryConfig.storyHeight) : null;
    case STAIR_RIBBON_KEYS.params.winderCount:
      return p.variant.kind === 'l-shape' && p.variant.cornerStyle === 'winders'
        ? String(p.variant.winderCount)
        : null;
    default: return null;
  }
}

// ── String patch helpers ─────────────────────────────────────────────────────

export function patchStairStringParam(
  prev: StairParams,
  key: StairRibbonStringComboKey,
  value: string,
): StairParams | null {
  switch (key) {
    case STAIR_RIBBON_KEYS.stringParams.structureType: {
      if (!VALID_STRUCTURE_TYPES.has(value)) return null;
      const structureType = value as StairStructureType;
      if (structureType === prev.structureType) return null;
      const riserType: StairRiserType = OPEN_RISER_STRUCTURE_TYPES.has(structureType) ? 'open' : 'closed';
      const nosingSide: StairNosingSide = SIDE_NOSING_STRUCTURE_TYPES.has(structureType) ? 'front-and-sides' : 'front';
      return { ...prev, structureType, riserType, nosingSide };
    }
    case STAIR_RIBBON_KEYS.stringParams.riserType: {
      if (value !== 'open' && value !== 'closed') return null;
      const riserType = value as StairRiserType;
      if (riserType === prev.riserType) return null;
      return { ...prev, riserType };
    }
    case STAIR_RIBBON_KEYS.stringParams.flight2TurnDirection:
      return patchFlightTurnDirection(prev, 0, value);
    case STAIR_RIBBON_KEYS.stringParams.flight3TurnDirection:
      return patchFlightTurnDirection(prev, 1, value);
    case STAIR_RIBBON_KEYS.stringParams.variantKind:
      return patchVariantKind(prev, value);
    case STAIR_RIBBON_KEYS.stringParams.cornerStyle:
      return patchLShapeCornerStyle(prev, value);
    case STAIR_RIBBON_KEYS.stringParams.winderMethod:
      return patchLShapeWinderMethod(prev, value);
    case STAIR_RIBBON_KEYS.stringParams.nokSubType:
      return patchNokSubType(prev, value);
    default: return null;
  }
}

/**
 * ADR-358 Phase 3g — patch `nokSubType` to one of the 4 scope categories.
 * Legacy `'secondary'` is normalised to `'low-rise'` on write so existing
 * docs migrate the next time the user touches the combobox.
 */
function patchNokSubType(prev: StairParams, value: string): StairParams | null {
  if (!VALID_NOK_SUB_TYPES.has(value)) return null;
  const next: StairNokSubType = value === 'secondary' ? 'low-rise' : (value as StairNokSubType);
  if (prev.nokSubType === next) return null;
  return { ...prev, nokSubType: next };
}

/**
 * ADR-358 Phase 3d — discriminated variant kind selector patch. Builds a
 * fresh variant of the target kind via `buildDefaultVariantFor` (factory
 * seeds kind-specific defaults from `prev` context: stepCount, width,
 * tread, basePoint). No-op when target kind equals current.
 */
function patchVariantKind(prev: StairParams, value: string): StairParams | null {
  if (!isStairKind(value)) return null;
  const targetKind = value as StairKind;
  if (prev.variant.kind === targetKind) return null;
  return { ...prev, variant: buildDefaultVariantFor(targetKind, prev) };
}

/**
 * ADR-358 Phase 3f — toggle l-shape corner detail between 'landing' and
 * 'winders'. landing→winders builds a fresh winders variant (NOK defaults:
 * winderCount=3, equal-going) preserving turnDirection; winders→landing
 * falls back to `buildDefaultVariantFor` landing default. No-op when not
 * l-shape or same style.
 */
function patchLShapeCornerStyle(prev: StairParams, value: string): StairParams | null {
  if (value !== 'landing' && value !== 'winders') return null;
  if (prev.variant.kind !== 'l-shape') return null;
  if (prev.variant.cornerStyle === value) return null;
  if (value === 'winders') {
    return { ...prev, variant: buildLShapeWindersVariant(prev) };
  }
  // winders → landing: build fresh landing variant from factory + preserve turnDirection.
  const landing = buildDefaultVariantFor('l-shape', prev);
  if (landing.kind !== 'l-shape') return null;
  return {
    ...prev,
    variant: { ...landing, turnDirection: prev.variant.turnDirection },
  };
}

function patchLShapeWinderMethod(prev: StairParams, value: string): StairParams | null {
  if (value !== 'equal-going' && value !== 'pie') return null;
  if (prev.variant.kind !== 'l-shape' || prev.variant.cornerStyle !== 'winders') return null;
  if (prev.variant.winderMethod === value) return null;
  const method = value as StairWinderMethod;
  return { ...prev, variant: { ...prev.variant, winderMethod: method } };
}

/**
 * ADR-358 Phase 7b2b-β Stream F — patch flight turn direction on the
 * discriminated `variant` union. Returns `null` for invalid kinds or no-op.
 */
function patchFlightTurnDirection(
  prev: StairParams,
  flightIndex: 0 | 1,
  value: string,
): StairParams | null {
  if (value !== 'left' && value !== 'right') return null;
  const next = value as StairTurnDirectionLR;
  const v = prev.variant;
  if (flightIndex === 0) {
    if (v.kind === 'l-shape' || v.kind === 'u-shape') {
      if (v.turnDirection === next) return null;
      return { ...prev, variant: { ...v, turnDirection: next } };
    }
    if (v.kind === 'gamma') {
      if (v.turnSequence[0] === next) return null;
      return {
        ...prev,
        variant: {
          ...v,
          turnSequence: [next, v.turnSequence[1]] as readonly [StairTurnDirectionLR, StairTurnDirectionLR],
        },
      };
    }
    return null;
  }
  // flightIndex === 1 → only gamma
  if (v.kind === 'gamma') {
    if (v.turnSequence[1] === next) return null;
    return {
      ...prev,
      variant: {
        ...v,
        turnSequence: [v.turnSequence[0], next] as readonly [StairTurnDirectionLR, StairTurnDirectionLR],
      },
    };
  }
  return null;
}

// ── Numeric patch helpers ────────────────────────────────────────────────────

export function patchStairNumericParam(
  prev: StairParams,
  key: StairRibbonComboKey,
  numeric: number,
  ctx: StairPatchContext,
): StairParams | null {
  switch (key) {
    case STAIR_RIBBON_KEYS.params.rise:          return patchRise(prev, numeric, ctx.scale);
    case STAIR_RIBBON_KEYS.params.tread:         return patchTread(prev, numeric, ctx.scale);
    case STAIR_RIBBON_KEYS.params.width:         return patchWidth(prev, numeric, ctx.scale);
    case STAIR_RIBBON_KEYS.params.stepCount:     return patchStepCount(prev, numeric);
    case STAIR_RIBBON_KEYS.params.storyCount:    return patchStoryCount(prev, numeric, ctx);
    case STAIR_RIBBON_KEYS.params.storyHeight:   return patchStoryHeight(prev, numeric);
    case STAIR_RIBBON_KEYS.params.winderCount:   return patchLShapeWinderCount(prev, numeric);
    default: return null;
  }
}

/**
 * ADR-358 Phase 3f — winder count edit for l-shape with winders. Clamps
 * to `[1, min(5, stepCount - 2)]` so both straight flights keep ≥1 tread.
 * Recomputes `flightSplit` so invariant `n1 + winderCount + n2 = stepCount`
 * holds; `totalRise` unaffected (winders consume rise like treads).
 */
function patchLShapeWinderCount(prev: StairParams, raw: number): StairParams | null {
  if (prev.variant.kind !== 'l-shape' || prev.variant.cornerStyle !== 'winders') return null;
  const maxAllowed = Math.max(1, Math.min(5, prev.stepCount - 2));
  const winderCount = Math.max(1, Math.min(maxAllowed, Math.round(raw)));
  if (winderCount === prev.variant.winderCount) return null;
  const flightSplit = splitTwoFlightsForWinders(prev.stepCount, winderCount);
  return {
    ...prev,
    variant: { ...prev.variant, winderCount, flightSplit },
  };
}

// ADR-358 Phase 9 — input arrives in mm (combobox option strings are mm).
// Clamp ranges are mm too. Convert to scene units before writing into
// `StairParams.{rise,tread,width}` which the geometry pipeline expects.
function patchRise(prev: StairParams, rawMm: number, scale: number): StairParams | null {
  const mm = clamp(rawMm, 50, 300);
  const rise = mm * scale;
  if (rise === prev.rise) return null;
  // ADR-358 Phase 9B-2 — when linked, rise is the primary lever; reconcile
  // re-derives stepCount + totalRise so the stair stays bound to the floor
  // envelope (Revit "Desired Riser Height" pattern). No-op in free mode.
  return reconcileLinkedStair(withRecomputedTotals({ ...prev, rise }));
}

function patchTread(prev: StairParams, rawMm: number, scale: number): StairParams | null {
  const mm = clamp(rawMm, 150, 500);
  const tread = mm * scale;
  if (tread === prev.tread) return null;
  return withRecomputedTotals({ ...prev, tread });
}

function patchWidth(prev: StairParams, rawMm: number, scale: number): StairParams | null {
  const mm = clamp(rawMm, 400, 4000);
  const width = mm * scale;
  if (width === prev.width) return null;
  return { ...prev, width };
}

function patchStepCount(prev: StairParams, raw: number): StairParams | null {
  const stepCount = Math.max(2, Math.round(raw));
  if (stepCount === prev.stepCount) return null;
  // ADR-358 Phase 9B-2 — when linked, stepCount is a secondary lever for
  // rise: keep stepCount as requested, derive rise so the stair still lands
  // on the story envelope, then reconcile (will no-op since math is exact).
  const cfg = prev.multiStoryConfig;
  if (cfg && cfg.linkedToFloor === true) {
    const mmPerSceneUnit = mmFactorFromWidth(prev.width);
    if (Number.isFinite(mmPerSceneUnit) && mmPerSceneUnit > 0) {
      const derivedRise = deriveRiseFromStepCount(
        stepCount,
        cfg.storyHeight,
        cfg.storyCount,
        mmPerSceneUnit,
      );
      if (derivedRise > 0) {
        return reconcileLinkedStair(
          withRecomputedTotals({ ...prev, stepCount, rise: derivedRise }),
        );
      }
    }
  }
  return reconcileLinkedStair(withRecomputedTotals({ ...prev, stepCount }));
}

function patchStoryCount(
  prev: StairParams,
  raw: number,
  ctx: StairPatchContext,
): StairParams | null {
  // ADR-358 Phase 9B-1 — clamp `storyCount` ("Διανυόμενοι Όροφοι" / stories
  // this stair traverses) to the physically available remaining floors above
  // the current one. When building context is unavailable (free mode,
  // building-level DXF) the cap falls back to total floors, then to raw int.
  const raw1 = Math.max(1, Math.round(raw));
  const ceiling = computeStoryCountCeiling(ctx);
  const storyCount = ceiling === null ? raw1 : Math.min(raw1, ceiling);
  const cur = prev.multiStoryConfig;
  if (cur && cur.storyCount === storyCount) return null;
  const multiStoryConfig: StairMultiStoryConfig = cur
    ? { ...cur, storyCount }
    : { topLevel: '', storyHeight: DEFAULT_STORY_HEIGHT_MM, storyCount };
  return { ...prev, multiStoryConfig };
}

function computeStoryCountCeiling(ctx: StairPatchContext): number | null {
  const total = ctx.buildingTotalFloors;
  if (!Number.isFinite(total) || total <= 0) return null;
  if (ctx.currentFloorNumber === null) return total;
  const remaining = total - Math.max(0, ctx.currentFloorNumber);
  return Math.max(1, remaining);
}

function patchStoryHeight(prev: StairParams, raw: number): StairParams | null {
  if (raw <= 0) return null;
  const storyHeight = raw;
  const cur = prev.multiStoryConfig;
  if (cur && cur.storyHeight === storyHeight) return null;
  // ADR-358 Phase 9 — manual edit unlinks the floor binding so the badge
  // flips from 🔗 to ⚠️ and the "Reset to floor" button reappears.
  const multiStoryConfig: StairMultiStoryConfig = cur
    ? { ...cur, storyHeight, linkedToFloor: false }
    : { topLevel: '', storyHeight, storyCount: 1, linkedToFloor: false };
  return { ...prev, multiStoryConfig };
}

// ── Geometry recompute ───────────────────────────────────────────────────────

function withRecomputedTotals(p: StairParams): StairParams {
  const totalRise = p.rise * p.stepCount;
  const totalRun = p.tread * Math.max(0, p.stepCount - 1);
  const pitch = (Math.atan2(p.rise, p.tread) * 180) / Math.PI;
  return { ...p, totalRise, totalRun, pitch };
}

function clamp(v: number, min: number, max: number): number {
  if (v < min) return min;
  if (v > max) return max;
  return v;
}
