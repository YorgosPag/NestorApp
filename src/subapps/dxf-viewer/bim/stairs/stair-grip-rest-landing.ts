/**
 * stair-grip-rest-landing — ADR-637 Phase 4-A intermediate rest-landing (πλατύσκαλο)
 * grip transforms, extracted from `stair-grip-transforms.ts` for file-size SRP (N.7.1).
 *
 * Pure transforms: a `stair-rest-landing-*` grip drag → new `StairParams` with the
 * targeted `restLandings[i]` patched (slide along the run / resize plan length). The
 * planner re-quantizes on recompute, so these only write the raw intent.
 */

import type { StairGeometry, StairParams, StairRestLanding } from '../types/stair-types';
import { projectCursorAxial } from './stair-grip-math';
import type { StairGripDragInput } from './stair-grip-transforms';
import { projectPointToPolylineOffset } from '../geometry/opening-axis-walk';
import { calculatePolylineLength } from '../../rendering/entities/shared/geometry-polyline-utils';

/** Keep `at` strictly inside (0,1); the planner re-quantizes to a legal level. */
const REST_LANDING_AT_EPSILON = 1e-3;

/** Below this developed-run length a projection can't be normalized → treat as degenerate. */
const MIN_RUN_LENGTH = 1e-9;

/**
 * Developed run length used to normalize a slide fraction and to cap a landing's
 * plan length. Rectilinear runs (straight / multi-flight / v-shape) carry a real
 * `totalRun`; curved runs (spiral/helical/elliptical/sketch) run with `totalRun = 0`,
 * so the developed length is the plan length of the sampled `walkline` instead.
 * Falls back to one tread when no usable geometry is available.
 */
function developedRunLength(
  params: Readonly<StairParams>,
  geometry: Readonly<StairGeometry> | undefined,
): number {
  if (params.totalRun > 0) return params.totalRun;
  const walkline = geometry?.walkline;
  if (walkline && walkline.length >= 2) {
    // `calculatePolylineLength` wants a mutable Point2D[]; a shallow copy of the
    // readonly Polyline3D satisfies it without a cast (Point3D ⊂ Point2D).
    return calculatePolylineLength([...walkline]);
  }
  return params.tread;
}

/** Immutably patch the `restLandings` entry at `idx`, matched by id upstream. */
function patchRestLanding(
  landings: readonly StairRestLanding[],
  idx: number,
  patch: Partial<StairRestLanding>,
): StairRestLanding[] {
  return landings.map((l, i) => (i === idx ? { ...l, ...patch } : l));
}

/** Locate the targeted landing by id → `{ landings, idx }`, or `null`. */
function findTargetLanding(
  params: StairParams,
  landingId: string | undefined,
): { landings: readonly StairRestLanding[]; idx: number } | null {
  if (!landingId) return null;
  const landings = params.restLandings;
  if (!landings || landings.length === 0) return null;
  const idx = landings.findIndex((l) => l.id === landingId);
  return idx < 0 ? null : { landings, idx };
}

/**
 * Slide a rest landing along the run → a 0..1 fraction written to
 * `restLandings[i].at`. `computeStairGeometry` re-quantizes to the nearest legal
 * level (`round(at·(stepCount−1))`, clamped to `[1, stepCount−2]`) on recompute,
 * so the treads re-flow on either side. Recompute-on-release UX.
 *
 * Two projection models, one per run family (ADR-637 Phase 4-C):
 *   - **Rectilinear** (`totalRun > 0`): project the cursor axially onto the run
 *     direction (mirror of `adjustFlightSplit`) ÷ `totalRun` — byte-identical to
 *     the Phase 4-A behaviour, so straight / multi-flight / v-shape are unchanged.
 *   - **Curved** (`totalRun = 0` — spiral/helical/elliptical/sketch): project the
 *     cursor onto the sampled `walkline` by ARC-LENGTH (the axial model is
 *     meaningless — there is no single run direction) ÷ the walkline's plan length.
 *     Reuses `projectPointToPolylineOffset` (ADR-363/615 SSoT) — no new polyline math.
 */
export function slideRestLanding(input: Readonly<StairGripDragInput>): StairParams {
  const { originalParams, currentPos, landingId, geometry } = input;
  const target = findTargetLanding(originalParams, landingId);
  if (!target) return originalParams;
  const current = target.landings[target.idx];

  let rawAt: number;
  if (originalParams.totalRun > 0) {
    rawAt = projectCursorAxial(originalParams, currentPos) / originalParams.totalRun;
  } else {
    const walkline = geometry?.walkline;
    const total = developedRunLength(originalParams, geometry);
    rawAt = walkline && walkline.length >= 2 && total > MIN_RUN_LENGTH
      ? projectPointToPolylineOffset(currentPos, walkline) / total
      : current.at; // no usable curve → leave the landing put
  }

  const at = Math.min(1 - REST_LANDING_AT_EPSILON, Math.max(REST_LANDING_AT_EPSILON, rawAt));
  return { ...originalParams, restLandings: patchRestLanding(target.landings, target.idx, { at }) };
}

/**
 * Resize a rest landing's plan length: project the cursor onto the landing's
 * travel axis (`along`, read from the handle SSoT) measured from the landing
 * centre; the new length = 2·|projection| (edge-to-centre ×2, so both the low and
 * high edge grips share one transform). Clamped to `[tread, developed run]`.
 * Written to `restLandings[i].length`.
 */
export function resizeRestLandingLength(input: Readonly<StairGripDragInput>): StairParams {
  const { originalParams, currentPos, landingId, geometry } = input;
  const target = findTargetLanding(originalParams, landingId);
  if (!target) return originalParams;
  const handle = geometry?.restLandingHandles?.find((h) => h.id === landingId);
  if (!handle) return originalParams;
  const dx = currentPos.x - handle.center.x;
  const dy = currentPos.y - handle.center.y;
  const proj = Math.abs(dx * handle.along.x + dy * handle.along.y);
  // Cap at the developed run length — `totalRun` for rectilinear (unchanged), the
  // walkline plan length for curved runs (`totalRun = 0`, else the cap would be one
  // tread and a curved landing could never grow).
  const maxLength = Math.max(originalParams.tread, developedRunLength(originalParams, geometry));
  const newLength = Math.min(maxLength, Math.max(originalParams.tread, proj * 2));
  return {
    ...originalParams,
    restLandings: patchRestLanding(target.landings, target.idx, { length: newLength }),
  };
}
