/**
 * ADR-358 Phase 9B-2 — Strict floor-bound stair reconciliation (Q35).
 *
 * Pure helpers: zero React / DOM / Firestore / canvas deps. When a stair
 * declares `multiStoryConfig.linkedToFloor === true`, its `stepCount` is
 * structurally DERIVED from `storyHeight × storyCount / rise` (Revit
 * "Desired Riser Height" pattern, ArchiCAD Story Sensitive Stair,
 * AutoCAD Architecture `bindToLevels`). `totalRise` is locked to the
 * declared envelope so the stair physically reaches the next floor.
 *
 * Industry convergence (Phase 9B plan, 5/5 vendor):
 *   - Revit: stepCount derived from level distance, manual override forbidden
 *     unless link broken.
 *   - ArchiCAD: totalRise locked to story distance.
 *   - AutoCAD Architecture: length grip clamped, stepCount read-only.
 *   - Vectorworks: story-aware grip resistance.
 *   - BricsCAD BIM: BIMSTAIR totalRise auto from level objects.
 *
 * Idempotency (critical): calling `reconcileLinkedStair` twice on the same
 * input returns referentially equal output the second time so the patch
 * pipeline (`withRecomputedTotals` ∘ reconcile) never loops.
 */

import type { StairCodeProfile, StairParams } from '../../types/stair';

// ─── Scene units heuristic (mirror of stair-validator / stair-auto-fix) ──────
//
// Same width-magnitude heuristic used across the stair codebase. Documented in
// ADR-358 §7.2 phase 9B-2 as a TODO follow-up: replace with `resolveSceneUnits`
// SSoT (utils/scene-units.ts) once the floor-link bridge graduates to the
// unified unit pipeline. Until then we keep behaviour-parity with the existing
// validator / auto-fix / grips heuristic.

export function mmFactorFromWidth(width: number): number {
  if (!Number.isFinite(width) || width <= 0) return 1;
  if (width < 10) return 1000;   // metres
  if (width < 100) return 10;    // centimetres
  return 1;                       // millimetres
}

// ─── Code-profile rise bounds (mirror of stair-auto-fix PROFILE_RANGES_MM) ───

const MIN_RISE_MM: Readonly<Record<StairCodeProfile, number>> = {
  nok: 130,
  ibc: 102,
  eurocode: 170,
  ada: 102,
  nbc: 130,
  nfpa: 102,
  as1657: 130,
  din: 140,
  none: 50,
};

const MAX_RISE_MM: Readonly<Record<StairCodeProfile, number>> = {
  nok: 180,
  ibc: 177.8,
  eurocode: 200,
  ada: 177.8,
  nbc: 200,
  nfpa: 177.8,
  as1657: 240,
  din: 200,
  none: 300,
};

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Code-aware upper bound on stepCount for a given story envelope. Uses the
 * profile's minimum riser height so the cap reflects the maximum number of
 * physically valid risers between the two floors.
 */
export function maxStepCountFor(
  storyHeightMm: number,
  storyCount: number,
  profile: StairCodeProfile,
): number {
  const total = storyHeightMm * storyCount;
  const minRise = MIN_RISE_MM[profile];
  if (!Number.isFinite(total) || total <= 0 || minRise <= 0) return 2;
  return Math.max(2, Math.floor(total / minRise));
}

/**
 * Code-aware lower bound on stepCount for a given story envelope. Uses the
 * profile's maximum riser height so the floor reflects the minimum number of
 * physically valid risers.
 */
export function minStepCountFor(
  storyHeightMm: number,
  storyCount: number,
  profile: StairCodeProfile,
): number {
  const total = storyHeightMm * storyCount;
  const maxRise = MAX_RISE_MM[profile];
  if (!Number.isFinite(total) || total <= 0 || maxRise <= 0) return 2;
  return Math.max(2, Math.ceil(total / maxRise));
}

/**
 * Inverse mapping used when the user edits `stepCount` on a linked stair:
 * compute the riser height that makes `stepCount` land exactly on the story
 * envelope. Result is returned in scene units (matching `StairParams.rise`).
 */
export function deriveRiseFromStepCount(
  stepCount: number,
  storyHeightMm: number,
  storyCount: number,
  mmPerSceneUnit: number,
): number {
  const safeCount = Math.max(2, Math.round(stepCount));
  const totalMm = storyHeightMm * storyCount;
  if (!Number.isFinite(totalMm) || totalMm <= 0) return 0;
  if (!Number.isFinite(mmPerSceneUnit) || mmPerSceneUnit <= 0) return 0;
  return totalMm / safeCount / mmPerSceneUnit;
}

/**
 * Strict reconciliation of a stair against its declared floor envelope.
 *
 * No-ops when `multiStoryConfig` is absent or `linkedToFloor !== true` so the
 * caller can apply unconditionally without branching. When linked:
 *   - `stepCount = round(storyHeight × storyCount / rise_mm)`
 *   - `totalRise = storyHeight × storyCount` (scene units after mm conversion)
 *   - `totalRun  = tread × (stepCount − 1)`
 *   - `pitch    = atan2(rise, tread)`
 *
 * Returns the original instance reference when no change is needed
 * (idempotency + render-skip optimisation).
 */
export function reconcileLinkedStair(params: StairParams): StairParams {
  const cfg = params.multiStoryConfig;
  if (!cfg || cfg.linkedToFloor !== true) return params;

  const mmPerSceneUnit = mmFactorFromWidth(params.width);
  if (!Number.isFinite(mmPerSceneUnit) || mmPerSceneUnit <= 0) return params;

  const targetTotalMm = cfg.storyHeight * cfg.storyCount;
  if (!Number.isFinite(targetTotalMm) || targetTotalMm <= 0) return params;

  const riseMm = params.rise * mmPerSceneUnit;
  if (!Number.isFinite(riseMm) || riseMm <= 0) return params;

  const derivedStepCount = Math.max(2, Math.round(targetTotalMm / riseMm));
  const totalRiseScene = targetTotalMm / mmPerSceneUnit;
  const totalRunScene = params.tread * Math.max(0, derivedStepCount - 1);
  const pitch = (Math.atan2(params.rise, params.tread) * 180) / Math.PI;

  if (
    params.stepCount === derivedStepCount
    && params.totalRise === totalRiseScene
    && params.totalRun === totalRunScene
    && params.pitch === pitch
  ) {
    return params;
  }

  return {
    ...params,
    stepCount: derivedStepCount,
    totalRise: totalRiseScene,
    totalRun: totalRunScene,
    pitch,
  };
}
