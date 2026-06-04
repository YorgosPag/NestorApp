/**
 * ADR-408 Φ11 — pipe-segment TRIM resolver (Revit "pipe ends at the fitting").
 *
 * A fitting occupies the corner/node; the straight pipes must STOP at the
 * fitting's connector face, not run through it (otherwise the runs cross in an
 * ugly X). This pure resolver computes, per pipe segment endpoint, how far (mm) to
 * shorten the drawn/meshed pipe so it butts exactly against the fitting:
 *
 *   - elbow  → the bend tangent length `R/tan(φ/2)` (R = 1.5·D) — the pipe stops
 *              where the curved bend body begins (the tangent point).
 *   - tee / cross / coupling / reducer → a half-diameter stub (the body half-extent).
 *   - cap    → 0 (the cap sits on the pipe end; nothing is trimmed).
 *
 * Pure & deterministic (reuses the junction derivation + classify + bend SSoT).
 * The host writes the result into `mep-segment-trim-store`; the 2D renderer + 3D
 * converter read it synchronously at draw time (ADR-040-safe, zero persistence).
 *
 * @see ../mep-systems/mep-pipe-junctions.ts
 * @see ./mep-fitting-classify.ts
 * @see ../geometry/mep-fitting-bend.ts
 * @see docs/centralized-systems/reference/adrs/ADR-408-mep-connectors-and-systems.md §Φ11
 */

import type { Entity } from '../../types/entities';
import { SEGMENT_START_CONNECTOR_ID } from '../types/mep-connector-types';
import { derivePipeJunctions } from '../mep-systems/mep-pipe-junctions';
import { classifyJunction } from './mep-fitting-classify';
import { computeElbowBend } from '../geometry/mep-fitting-bend';

/** Trim distances (mm) to remove from each end of a pipe segment. */
export interface SegmentTrim {
  readonly startMm: number;
  readonly endMm: number;
}

/** Non-elbow body half-extent as a fraction of the nominal diameter. */
const BODY_STUB_FACTOR = 0.5;

/**
 * Resolve the per-segment trim map for a scene. Key = segmentId; value = how much
 * (mm) to shorten each end so the pipe meets — but does not cross — its fitting.
 * Segments with no fitting at an end keep 0 there.
 */
export function resolveSegmentTrims(entities: readonly Entity[]): Map<string, SegmentTrim> {
  const trims = new Map<string, SegmentTrim>();
  const set = (segmentId: string, end: 'start' | 'end', mm: number): void => {
    const cur = trims.get(segmentId) ?? { startMm: 0, endMm: 0 };
    trims.set(
      segmentId,
      end === 'start' ? { startMm: mm, endMm: cur.endMm } : { startMm: cur.startMm, endMm: mm },
    );
  };

  for (const junction of derivePipeJunctions(entities)) {
    const classification = classifyJunction(junction);
    if (classification.kind === null || classification.kind === 'cap') continue;

    const trimMm = junctionTrimMm(junction, classification.kind, classification.primaryDiameterMm);
    if (trimMm <= 0) continue;

    for (const inc of junction.incidents) {
      const end = inc.connectorId === SEGMENT_START_CONNECTOR_ID ? 'start' : 'end';
      set(inc.segmentId, end, trimMm);
    }
  }
  return trims;
}

/** Trim length (mm) the fitting body extends along each incident leg. */
function junctionTrimMm(
  junction: ReturnType<typeof derivePipeJunctions>[number],
  kind: string,
  primaryDiameterMm: number,
): number {
  if (kind === 'elbow' && junction.incidents.length >= 2) {
    const bend = computeElbowBend(
      { x: 0, y: 0 },
      junction.incidents[0]!.directionUnit,
      junction.incidents[1]!.directionUnit,
      primaryDiameterMm,
    );
    if (bend) return bend.tangentLen;
  }
  return primaryDiameterMm * BODY_STUB_FACTOR;
}
