/**
 * ADR-358 Phase 6 + 6.5 — Stair validator SSoT facade.
 *
 * Pure function: zero React / DOM / Firestore / canvas deps. Wraps the
 * `gateStairChecker` engine (4 code profiles + hard errors + egress) and adds
 * a cheap 2D headroom proxy check (Q29 hybrid: cheap real-time part; Phase 9
 * will replace with 3D raycast over per-step nosing positions).
 *
 * Headroom proxy (Phase 6 cheap 2D):
 *   - Filter context entities by layer regex /ceiling|slab|roof/i.
 *   - Read `metadata.elevation` (mm) when present; entities without elevation
 *     are skipped (no false positives).
 *   - Clearance = ceiling.elevation − (params.basePoint.z + params.totalRise).
 *   - Violation if clearance < `MIN_HEADROOM[codeProfile]`.
 *
 * Egress G20 (Phase 6.5):
 *   - Universal IBC §1011.5 capacity check: `width < occupancyLoad × 7.62mm`.
 *   - Resolution order: `projectOccupancyLoad` (Q27 project setting) wins over
 *     `params.occupancyLoad` (per-stair override). If both absent → skipped.
 *   - Skipped when `codeProfile === 'none'`.
 *
 * Validator behavior (§5.9):
 *   - hardErrors → caller blocks creation.
 *   - codeViolations / adaViolations / headroomViolations / egressViolations
 *     → non-blocking, red badge in property panel, entity created with
 *     `validation.hasCodeViolations = true`.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-358-dxf-stair-tool-google-level.md §5.9 §3.5 §3.7 §9.2 Q25 Q26 Q27 Q29
 */

import { nowTimestamp } from '@/lib/firestore-now';
import { gateStairChecker } from '@/services/building-code/engines/gate-stair-checker';
import type { Entity } from '../../types/entities';
import type { SceneLayer } from '../../types/scene';
import type {
  StairCodeProfile,
  StairParams,
  StairValidationState,
} from '../../bim/types/stair-types';
// ─── Headroom thresholds (cheap 2D proxy, Phase 6) ───────────────────────────

const MIN_HEADROOM_MM: Readonly<Record<StairCodeProfile, number>> = {
  nok: 2030,
  ibc: 2030,
  eurocode: 2030,
  ada: 2032,
  nbc: 2030,
  nfpa: 2030,
  as1657: 2030,
  din: 2030,
  none: 0,
};

const CEILING_LAYER_RE = /ceiling|slab|roof/i;

// ─── Single-flight max risers (industry: landing required beyond limit) ──────
//
// Building codes cap the number of risers in one uninterrupted flight to
// force a landing — fatigue + fall-safety + egress rules. Source:
//   NOK (Greek)  art. 18 §1 — 18 max
//   IBC §1011.8 — 16 max (12 in some occupancies; we use the relaxed 16)
//   Eurocode EN 17210 §6.6.4 — 16 max
//   ADA / ICC A117.1 — 16 max
//   AS1657      — 18 max
//   DIN 18065   — 18 max
//   NBC         — 18 max
//   NFPA 101    — 16 max (means-of-egress)
//
// When `params.stepCount` exceeds the limit, a non-blocking code-violation
// surfaces in the red badge so the user knows the flight needs a landing.
const MAX_FLIGHT_RISERS: Readonly<Record<StairCodeProfile, number>> = {
  nok: 18,
  ibc: 16,
  eurocode: 16,
  ada: 16,
  nbc: 18,
  nfpa: 16,
  as1657: 18,
  din: 18,
  none: Number.POSITIVE_INFINITY,
};

function checkSingleFlightLimit(
  params: Readonly<StairParams>,
): readonly string[] {
  const limit = MAX_FLIGHT_RISERS[params.codeProfile];
  if (!Number.isFinite(limit)) return [];
  if (params.stepCount > limit) {
    return ['tools.stair.validator.singleFlightOverLimit'];
  }
  return [];
}

// ─── Story-height overflow (G11 multi-storey check) ──────────────────────────
//
// When the stair declares a `multiStoryConfig`, the parametric `totalRise`
// must not exceed `storyHeight × storyCount`. Industry: Revit Multistory,
// ArchiCAD Multi-Level — both refuse to commit a flight that overflows the
// declared story group. We surface as non-blocking code-violation so the
// user can resize via grip / panel without losing work.
/**
 * Project numeric stair fields used by `gateStairChecker` (mm-baked code
 * thresholds) into mm regardless of the scene's coordinate units. Mirror
 * of `mmFactorFromWidth` in `stair-auto-fix.ts` / `stair-grips.ts`.
 */
function paramsToMmForCodeCheck(params: Readonly<StairParams>): StairParams {
  const mmPerSceneUnit = mmFactorFromWidth(params.width);
  if (mmPerSceneUnit === 1) return params;
  return {
    ...params,
    width: params.width * mmPerSceneUnit,
    rise: params.rise * mmPerSceneUnit,
    tread: params.tread * mmPerSceneUnit,
    handrails: {
      ...params.handrails,
      height: params.handrails.height * mmPerSceneUnit,
      ...(params.handrails.topExtension !== undefined
        ? { topExtension: params.handrails.topExtension * mmPerSceneUnit }
        : {}),
    },
  };
}

function mmFactorFromWidth(width: number): number {
  if (!Number.isFinite(width) || width <= 0) return 1;
  if (width < 10) return 1000;   // metres
  if (width < 100) return 10;    // centimetres
  return 1;                       // millimetres (or larger units)
}

function checkStoryHeightOverflow(
  params: Readonly<StairParams>,
): readonly string[] {
  const cfg = params.multiStoryConfig;
  if (!cfg) return [];
  // `storyHeight` is published by the ribbon options in mm (hardcoded
  // 2400 / 2500 / ...), while `params.totalRise` lives in scene units.
  // Normalise to mm so the comparison is unit-consistent.
  const mmPerSceneUnit = mmFactorFromWidth(params.width);
  const allowedMm = cfg.storyHeight * cfg.storyCount;
  const totalRiseMm = params.totalRise * mmPerSceneUnit;
  if (!Number.isFinite(allowedMm) || allowedMm <= 0) return [];
  if (totalRiseMm > allowedMm + 1) {
    // ADR-358 Phase 9B-2 — when linked to a floor, exceeding the envelope is
    // a hard error (red), not a warning. The reconcile pipeline should have
    // prevented this; any remaining overflow is a structural break that
    // blocks creation / blocks commit upstream.
    return cfg.linkedToFloor === true
      ? ['tools.stair.validator.hardError.totalRiseOverFloor']
      : ['tools.stair.validator.totalRiseOverStoryHeight'];
  }
  return [];
}

/**
 * Symmetric check: when `multiStoryConfig` is declared, the stair MUST reach
 * the target story; a flight that stops short is just as broken as one that
 * overshoots. Industry: Revit Multistory + ArchiCAD Multi-Level both flag a
 * `totalRise < storyHeight × storyCount` as an unfinished flight.
 *
 * Tolerance allows the user to be 1mm short without nagging (floating-point
 * drift from grip drag in metres → mm).
 */
function checkStoryHeightUnderflow(
  params: Readonly<StairParams>,
): readonly string[] {
  const cfg = params.multiStoryConfig;
  if (!cfg) return [];
  // Same mm-vs-scene-units guard as `checkStoryHeightOverflow`.
  const mmPerSceneUnit = mmFactorFromWidth(params.width);
  const targetMm = cfg.storyHeight * cfg.storyCount;
  const totalRiseMm = params.totalRise * mmPerSceneUnit;
  if (!Number.isFinite(targetMm) || targetMm <= 0) return [];
  if (totalRiseMm + 1 < targetMm) {
    // ADR-358 Phase 9B-2 — symmetric hard error when linked: a stair that
    // does not reach the next floor is a structural break, not a warning.
    return cfg.linkedToFloor === true
      ? ['tools.stair.validator.hardError.totalRiseUnderFloor']
      : ['tools.stair.validator.totalRiseBelowStoryHeight'];
  }
  return [];
}

/**
 * Universal sanity warning when the stair is suspiciously short (< 1m total
 * rise). Catches the "I dragged the length grip down to 3 steps but my house
 * is 3m tall" case where no `multiStoryConfig` is set. Code-profile gated so
 * `none` users (free-form CAD) are not nagged.
 */
const MIN_PLAUSIBLE_TOTAL_RISE_MM = 1000;
function checkTotalRiseTooLow(
  params: Readonly<StairParams>,
): readonly string[] {
  if (params.codeProfile === 'none') return [];
  const mmPerSceneUnit = mmFactorFromWidth(params.width);
  const totalRiseMm = params.totalRise * mmPerSceneUnit;
  if (totalRiseMm > 0 && totalRiseMm < MIN_PLAUSIBLE_TOTAL_RISE_MM) {
    return ['tools.stair.validator.totalRiseTooLow'];
  }
  return [];
}

// ─── Headroom check (cheap 2D, Phase 6) ──────────────────────────────────────

function extractEntityElevation(entity: Readonly<Entity>): number | null {
  const meta = entity.metadata;
  if (!meta) return null;
  const raw = (meta as Readonly<Record<string, unknown>>).elevation;
  return typeof raw === 'number' && Number.isFinite(raw) ? raw : null;
}

function checkHeadroom(
  params: Readonly<StairParams>,
  contextEntities: readonly Entity[],
  layersById?: Record<string, SceneLayer>,
): readonly string[] {
  const profile = params.codeProfile;
  if (profile === 'none' || contextEntities.length === 0) return [];
  const minClearance = MIN_HEADROOM_MM[profile];
  const stairTopZ = params.basePoint.z + params.totalRise;
  for (const entity of contextEntities) {
    const layerName = entity.layerId && layersById ? layersById[entity.layerId]?.name : undefined;
    if (!layerName || !CEILING_LAYER_RE.test(layerName)) continue;
    const elevation = extractEntityElevation(entity);
    if (elevation === null) continue;
    const clearance = elevation - stairTopZ;
    if (clearance < minClearance) return ['tools.stair.validator.headroomBelowMin'];
  }
  return [];
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Validate a `StairParams` against its declared `codeProfile` + universal
 * hard-error baseline + cheap 2D headroom proxy + egress capacity check.
 * Returns a fully-populated `StairValidationState` ready to be embedded in
 * `StairEntity.validation`.
 *
 * @param params Parametric stair input (codeProfile + nokSubType read internally).
 * @param contextEntities Optional scene entities for the headroom proxy. Pass
 *   an empty array (or omit) to skip the headroom step.
 * @param projectOccupancyLoad Optional Q27 project-default occupancy load.
 *   When present overrides `params.occupancyLoad`. When absent the per-stair
 *   `params.occupancyLoad` is used. When both absent the egress check is
 *   skipped (no false positives).
 */
export function validateStairParams(
  params: Readonly<StairParams>,
  contextEntities: readonly Entity[] = [],
  projectOccupancyLoad?: number,
  layersById?: Record<string, SceneLayer>,
): StairValidationState {
  const occupancyLoad = projectOccupancyLoad ?? params.occupancyLoad;
  // `gateStairChecker` thresholds are mm-baked (NOK / IBC / Eurocode / ADA
  // codes are written in mm). Scenes can be in m / cm / mm — project the
  // numeric stair fields to mm via the same heuristic used by
  // `mmFactorFromWidth` (stair-auto-fix.ts) so the comparison is unit-
  // consistent. Without this every metre-scale stair tripped `rise < 130`,
  // `tread < 260`, etc. regardless of actual value (regression observed
  // 2026-05-17).
  const paramsForGate = paramsToMmForCodeCheck(params);
  const gate = gateStairChecker({
    params: paramsForGate,
    codeProfile: params.codeProfile,
    nokSubType: params.nokSubType,
    occupancyLoad,
  });
  const headroomViolations = checkHeadroom(params, contextEntities, layersById);
  const flightLimitViolations = checkSingleFlightLimit(params);
  const storyOverflowViolations = checkStoryHeightOverflow(params);
  const storyUnderflowViolations = checkStoryHeightUnderflow(params);
  const totalRiseTooLowViolations = checkTotalRiseTooLow(params);
  const violationKeys: readonly string[] = [
    ...gate.hardErrors,
    ...gate.codeViolations,
    ...gate.adaViolations,
    ...gate.egressViolations,
    ...headroomViolations,
    ...flightLimitViolations,
    ...storyOverflowViolations,
    ...storyUnderflowViolations,
    ...totalRiseTooLowViolations,
  ];
  // ADR-358 Phase 9B-2 — promote floor-bound overflow/underflow keys into
  // the `hardErrors` field so the partition logic in `StairWarningsSection`
  // routes them to the red box (StairWarningsSection prefers the explicit
  // field when present; without this they would land in the soft list).
  const linkedHardErrors = [
    ...storyOverflowViolations.filter(isFloorHardErrorKey),
    ...storyUnderflowViolations.filter(isFloorHardErrorKey),
  ];
  const allHardErrors: readonly string[] = [...gate.hardErrors, ...linkedHardErrors];
  // ADR-358 / SOS N.6 — Firestore rejects `undefined`. Optional arrays are
  // omitted via conditional spread instead of being set to `undefined`, so
  // `setDoc()` from the stair persistence service never hits the
  // "Unsupported field value: undefined" error on writes.
  return {
    hasCodeViolations: violationKeys.length > 0,
    violationKeys,
    ...(allHardErrors.length > 0 ? { hardErrors: allHardErrors } : {}),
    ...(headroomViolations.length > 0 ? { headroomViolations } : {}),
    ...(gate.egressViolations.length > 0 ? { egressViolations: gate.egressViolations } : {}),
    ...(gate.adaViolations.length > 0 ? { adaViolations: gate.adaViolations } : {}),
    // ADR-358 Phase 3g — yellow comfort warnings (NOK width below industry
    // comfort threshold). Disjoint from `violationKeys`. UI routes to soft
    // yellow band instead of red.
    ...(gate.comfortViolations.length > 0 ? { comfortViolations: gate.comfortViolations } : {}),
    lastValidatedAt: nowTimestamp(),
  };
}

function isFloorHardErrorKey(key: string): boolean {
  return key.startsWith('tools.stair.validator.hardError.');
}

/** Re-export the engine result shape for callers that want raw access. */
export type { GateStairCheckerResult } from '@/services/building-code/engines/gate-stair-checker';
