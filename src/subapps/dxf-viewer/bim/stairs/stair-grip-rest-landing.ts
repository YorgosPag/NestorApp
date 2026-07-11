/**
 * stair-grip-rest-landing — ADR-637 Phase 4-A intermediate rest-landing (πλατύσκαλο)
 * grip transforms, extracted from `stair-grip-transforms.ts` for file-size SRP (N.7.1).
 *
 * Pure transforms: a `stair-rest-landing-*` grip drag → new `StairParams` with the
 * targeted `restLandings[i]` patched (slide along the run / resize plan length). The
 * planner re-quantizes on recompute, so these only write the raw intent.
 */

import type { StairParams, StairRestLanding } from '../types/stair-types';
import { projectCursorAxial } from './stair-grip-math';
import type { StairGripDragInput } from './stair-grip-transforms';

/** Keep `at` strictly inside (0,1); the planner re-quantizes to a legal level. */
const REST_LANDING_AT_EPSILON = 1e-3;

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
 * Slide a rest landing along the run: project the cursor axially onto the run
 * direction (mirror of `adjustFlightSplit`) → a 0..1 fraction of the developed
 * run written to `restLandings[i].at`. `computeStairGeometry` re-quantizes to the
 * nearest legal level (`round(at·(stepCount−1))`, clamped to `[1, stepCount−2]`)
 * on recompute, so the treads re-flow on either side. Recompute-on-release UX.
 */
export function slideRestLanding(input: Readonly<StairGripDragInput>): StairParams {
  const { originalParams, currentPos, landingId } = input;
  const target = findTargetLanding(originalParams, landingId);
  if (!target) return originalParams;
  const projOnDir = projectCursorAxial(originalParams, currentPos);
  const denom = originalParams.totalRun || 1;
  const rawAt = projOnDir / denom;
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
  const maxLength = Math.max(originalParams.tread, originalParams.totalRun || originalParams.tread);
  const newLength = Math.min(maxLength, Math.max(originalParams.tread, proj * 2));
  return {
    ...originalParams,
    restLandings: patchRestLanding(target.landings, target.idx, { length: newLength }),
  };
}
