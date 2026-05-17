/**
 * ADR-358 Phase 6.5 follow-up (2026-05-17) — auto-fix engine for stair
 * code-violations. Pure function: given a `StairParams` + its effective
 * `codeProfile`, returns a new `StairParams` with every fixable field
 * clamped to the closest in-range value.
 *
 * Industry pattern (Revit "Resolve Warning", ArchiCAD "Auto-fix", Tekla
 * "Code Check Resolve"): user keeps full control of the structural intent
 * (basePoint, direction, kind, structureType, materials, scope), and the
 * auto-fix is allowed to mutate only the numeric stair geometry that is
 * out of code range. Aggressive fields like `multiStoryConfig` are also
 * preserved untouched.
 *
 * Limits source: `gate-stair-checker` per-profile thresholds. Values are
 * expressed in mm here because the validator engine operates in mm; the
 * caller is responsible for converting between scene-units ↔ mm via the
 * `scene-units` SSoT helpers (`mmToSceneUnits`) when delivering the result
 * back to a metre/cm scene.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-358-dxf-stair-tool-google-level.md §3.5 §5.9 §9.2 Q25
 * @see services/building-code/engines/gate-stair-checker — source of truth for ranges
 */

import type {
  StairCodeProfile,
  StairNokSubType,
  StairParams,
} from '../../types/stair';

// ============================================================================
// PER-PROFILE CODE RANGES (mirror of gate-stair-checker, mm-scale)
// ============================================================================

interface ProfileRanges {
  readonly widthMin: number;
  readonly riseMin: number;
  readonly riseMax: number;
  readonly treadMin: number;
  readonly treadMax: number;
  readonly twoRGMin: number | null;
  readonly twoRGMax: number | null;
  readonly maxFlightRisers: number;
}

const PROFILE_RANGES_MM: Readonly<Record<StairCodeProfile, ProfileRanges>> = {
  // NOK κύρια defaults — `nokSubType==='secondary'` swap handled in resolver.
  nok: {
    widthMin: 1200,
    riseMin: 130,
    riseMax: 180,
    treadMin: 260,
    treadMax: 320,
    twoRGMin: 600,
    twoRGMax: 640,
    maxFlightRisers: 18,
  },
  ibc: {
    widthMin: 1117,
    riseMin: 102, // IBC §1011.5 (4")
    riseMax: 177.8, // IBC §1011.5 (7")
    treadMin: 279.4, // IBC §1011.5 (11")
    treadMax: 400,
    twoRGMin: null,
    twoRGMax: null,
    maxFlightRisers: 16,
  },
  eurocode: {
    widthMin: 1000,
    riseMin: 170,
    riseMax: 200,
    treadMin: 230,
    treadMax: 300,
    twoRGMin: 600,
    twoRGMax: 650,
    maxFlightRisers: 16,
  },
  ada: {
    widthMin: 1117,
    riseMin: 102,
    riseMax: 177.8,
    treadMin: 279.4,
    treadMax: 400,
    twoRGMin: null,
    twoRGMax: null,
    maxFlightRisers: 16,
  },
  // NBC / NFPA / AS1657 / DIN — placeholder per `gate-stair-checker` (no
  // enforced range yet). Use widely-applicable safe defaults so auto-fix
  // produces a sensible stair even when the profile validator is a no-op.
  nbc: { widthMin: 900, riseMin: 130, riseMax: 200, treadMin: 230, treadMax: 320, twoRGMin: 600, twoRGMax: 650, maxFlightRisers: 18 },
  nfpa: { widthMin: 1117, riseMin: 102, riseMax: 177.8, treadMin: 279.4, treadMax: 400, twoRGMin: null, twoRGMax: null, maxFlightRisers: 16 },
  as1657: { widthMin: 600, riseMin: 130, riseMax: 240, treadMin: 215, treadMax: 355, twoRGMin: null, twoRGMax: null, maxFlightRisers: 18 },
  din: { widthMin: 800, riseMin: 140, riseMax: 200, treadMin: 230, treadMax: 320, twoRGMin: 590, twoRGMax: 650, maxFlightRisers: 18 },
  none: { widthMin: 0, riseMin: 1, riseMax: Number.POSITIVE_INFINITY, treadMin: 1, treadMax: Number.POSITIVE_INFINITY, twoRGMin: null, twoRGMax: null, maxFlightRisers: Number.POSITIVE_INFINITY },
};

const NOK_SECONDARY_OVERRIDE: ProfileRanges = {
  widthMin: 900,
  riseMin: 140,
  riseMax: 200,
  treadMin: 230,
  treadMax: 280,
  twoRGMin: null, // 2R+G constraint relaxed for secondary
  twoRGMax: null,
  maxFlightRisers: 18,
};

function resolveRanges(
  profile: StairCodeProfile,
  nokSubType: StairNokSubType | undefined,
): ProfileRanges {
  if (profile === 'nok' && nokSubType === 'secondary') {
    return NOK_SECONDARY_OVERRIDE;
  }
  return PROFILE_RANGES_MM[profile];
}

// ============================================================================
// SCENE-UNITS HEURISTIC (mirror of stair-completion.ts + stair-grips.ts)
// ============================================================================

/**
 * Detect the mm-per-scene-unit factor from the current width magnitude.
 * Same heuristic used by `minWidthFloorFor` (stair-grips) and
 * `detectSceneUnits` (utils/scene-units).
 */
function mmFactorFromWidth(width: number): number {
  if (!Number.isFinite(width) || width <= 0) return 1;
  if (width < 10) return 1000;   // metres   — 1 scene-unit = 1000 mm
  if (width < 100) return 10;    // centimetres — 1 scene-unit = 10 mm
  return 1;                       // millimetres
}

function mmToScene(valueMm: number, mmPerSceneUnit: number): number {
  return valueMm / mmPerSceneUnit;
}

function sceneToMm(valueScene: number, mmPerSceneUnit: number): number {
  return valueScene * mmPerSceneUnit;
}

// ============================================================================
// CORE
// ============================================================================

function clampMidpoint(
  valueMm: number,
  minMm: number,
  maxMm: number,
): number {
  if (!Number.isFinite(maxMm)) {
    return Math.max(valueMm, minMm);
  }
  if (valueMm < minMm || valueMm > maxMm) {
    return (minMm + maxMm) / 2;
  }
  return valueMm;
}

/**
 * Auto-fix the numeric stair geometry so it satisfies the active code
 * profile. Returns the same instance reference when no change is needed.
 *
 * Touch surface: `rise`, `tread`, `width`, `stepCount`, `totalRise`,
 * `totalRun`, `pitch`. Everything else (basePoint, direction, kind,
 * structureType, materials, multiStoryConfig, labels) is preserved
 * verbatim so the user's design intent stays intact.
 */
export function autoFixStairParams(params: StairParams): StairParams {
  const ranges = resolveRanges(params.codeProfile, params.nokSubType);
  const mmPerSceneUnit = mmFactorFromWidth(params.width);

  // Project the scene-units geometry to mm so we can compare against the
  // code ranges, then project the fix back to scene-units before returning.
  const riseMm = sceneToMm(params.rise, mmPerSceneUnit);
  const treadMm = sceneToMm(params.tread, mmPerSceneUnit);
  const widthMm = sceneToMm(params.width, mmPerSceneUnit);

  let nextRiseMm = clampMidpoint(riseMm, ranges.riseMin, ranges.riseMax);
  let nextTreadMm = clampMidpoint(treadMm, ranges.treadMin, ranges.treadMax);
  const nextWidthMm = Math.max(widthMm, ranges.widthMin);

  // 2R+G snap when the profile carries the Blondel rule.
  if (ranges.twoRGMin !== null && ranges.twoRGMax !== null) {
    const twoRG = 2 * nextRiseMm + nextTreadMm;
    if (twoRG < ranges.twoRGMin || twoRG > ranges.twoRGMax) {
      const targetTwoRG = (ranges.twoRGMin + ranges.twoRGMax) / 2;
      // Solve for tread (more visually disruptive to change rise mid-flight):
      //   tread = targetTwoRG − 2 × rise
      // Then clamp the result back to the tread range.
      const candidateTread = targetTwoRG - 2 * nextRiseMm;
      nextTreadMm = clampMidpoint(candidateTread, ranges.treadMin, ranges.treadMax);
      // If clamp moved tread off the equation, snap rise instead.
      const recomputed = 2 * nextRiseMm + nextTreadMm;
      if (recomputed < ranges.twoRGMin || recomputed > ranges.twoRGMax) {
        const candidateRise = (targetTwoRG - nextTreadMm) / 2;
        nextRiseMm = clampMidpoint(candidateRise, ranges.riseMin, ranges.riseMax);
      }
    }
  }

  // Single-flight limit — cap stepCount, keep totalRise consistent.
  const flightCap = ranges.maxFlightRisers;
  const nextStepCount = Number.isFinite(flightCap)
    ? Math.max(2, Math.min(params.stepCount, flightCap))
    : Math.max(2, params.stepCount);

  // Multi-story: shrink (overflow) OR grow (underflow) stepCount so the
  // total rise lands on the declared story envelope. Industry-symmetric
  // with the corresponding validator checks (`checkStoryHeightOverflow` +
  // `checkStoryHeightUnderflow`). Floor for overflow, ceil for underflow
  // so the auto-fix always lands ≥ target rather than 1 riser short.
  let finalStepCount = nextStepCount;
  if (params.multiStoryConfig) {
    // `multiStoryConfig.storyHeight` is mm-hardcoded by the ribbon options
    // (2400 / 2500 / ... / 3500), so it is ALREADY in mm — no further
    // scene-units conversion needed. `nextRiseMm` is mm as well.
    const targetTotalMm =
      params.multiStoryConfig.storyHeight * params.multiStoryConfig.storyCount;
    if (targetTotalMm > 0 && Number.isFinite(nextRiseMm) && nextRiseMm > 0) {
      const maxByStory = Math.max(2, Math.floor(targetTotalMm / nextRiseMm));
      const idealByStory = Math.max(2, Math.ceil(targetTotalMm / nextRiseMm));
      // Shrink to overflow cap when current exceeds the story envelope.
      finalStepCount = Math.min(finalStepCount, maxByStory);
      // Grow to reach the story when current falls short, but never exceed
      // the single-flight cap (would re-trigger `singleFlightOverLimit`).
      const targetSteps = Number.isFinite(flightCap)
        ? Math.min(idealByStory, flightCap)
        : idealByStory;
      if (targetSteps > finalStepCount) {
        finalStepCount = targetSteps;
      }
    }
  }

  const nextRiseScene = mmToScene(nextRiseMm, mmPerSceneUnit);
  const nextTreadScene = mmToScene(nextTreadMm, mmPerSceneUnit);
  const nextWidthScene = mmToScene(nextWidthMm, mmPerSceneUnit);
  const nextTotalRise = nextRiseScene * finalStepCount;
  const nextTotalRun = nextTreadScene * (finalStepCount - 1);
  const nextPitch = Math.atan2(nextRiseScene, nextTreadScene) * (180 / Math.PI);

  // Early-out when nothing actually changed → preserve referential equality.
  if (
    nextRiseScene === params.rise
    && nextTreadScene === params.tread
    && nextWidthScene === params.width
    && finalStepCount === params.stepCount
  ) {
    return params;
  }

  return {
    ...params,
    rise: nextRiseScene,
    tread: nextTreadScene,
    width: nextWidthScene,
    stepCount: finalStepCount,
    totalRise: nextTotalRise,
    totalRun: nextTotalRun,
    pitch: nextPitch,
  };
}
