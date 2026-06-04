/**
 * ADR-408 Φ11 — pipe-segment TRIM resolver (Revit "pipe ends at the fitting").
 *
 * A fitting occupies the corner/node; the straight pipes must STOP at the
 * fitting's connector face, not run through it (otherwise the runs cross in an
 * ugly X). This pure resolver computes, per pipe segment endpoint, how far (mm) to
 * shorten the drawn/meshed pipe so it butts exactly against the fitting:
 *
 *   - elbow            → the bend tangent length `R/tan(φ/2)` (the pipe stops where
 *                        the curved bend body begins, the tangent point).
 *   - coupling/reducer → the inline body half-length.
 *   - tee / cross      → the arm half-extent.
 *   - cap              → 0 (the cap sits on the pipe end; nothing is trimmed).
 *
 * Every distance comes from the SAME generic body SSoT (`fittingTrimExtent`) that
 * draws the 2D footprint + the 3D mesh, so a pipe is cut exactly to the body it
 * meets — no per-resolver heuristic that could drift from the drawn shape.
 *
 * Pure & deterministic (reuses the junction derivation + classify + body SSoT).
 * The host writes the result into `mep-segment-trim-store`; the 2D renderer + 3D
 * converter read it synchronously at draw time (ADR-040-safe, zero persistence).
 *
 * @see ../mep-systems/mep-pipe-junctions.ts
 * @see ./mep-fitting-classify.ts
 * @see ../geometry/mep-fitting-body.ts
 * @see docs/centralized-systems/reference/adrs/ADR-408-mep-connectors-and-systems.md §Φ11
 */

import type { Entity } from '../../types/entities';
import type { MepFittingKind } from '../types/mep-fitting-types';
import { SEGMENT_START_CONNECTOR_ID } from '../types/mep-connector-types';
import { derivePipeJunctions } from '../mep-systems/mep-pipe-junctions';
import type { PipeJunction } from '../mep-systems/mep-pipe-junctions';
import { classifyJunction } from './mep-fitting-classify';
import type { FittingClassification } from './mep-fitting-classify';
import {
  computeFittingBody,
  fittingTrimExtent,
  type FittingBodyInput,
} from '../geometry/mep-fitting-body';

/** Trim distances (mm) to remove from each end of a pipe segment. */
export interface SegmentTrim {
  readonly startMm: number;
  readonly endMm: number;
}

/** Rare degenerate (null-body) fallback half-extent as a fraction of the Ø. */
const DEGENERATE_TRIM_FACTOR = 0.5;

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

    const trimMm = junctionTrimMm(junction, classification.kind, classification);
    if (trimMm <= 0) continue;

    for (const inc of junction.incidents) {
      const end = inc.connectorId === SEGMENT_START_CONNECTOR_ID ? 'start' : 'end';
      set(inc.segmentId, end, trimMm);
    }
  }
  return trims;
}

/**
 * Trim length (mm) the fitting body extends along each incident leg — the body
 * half-extent from the shared SSoT (`computeFittingBody` runs in mm, node at the
 * origin). Falls back to a half-diameter stub only for a degenerate node.
 */
function junctionTrimMm(
  junction: PipeJunction,
  kind: MepFittingKind,
  classification: FittingClassification,
): number {
  const body = computeFittingBody(toBodyInput(junction, kind, classification));
  return body ? fittingTrimExtent(body) : classification.primaryDiameterMm * DEGENERATE_TRIM_FACTOR;
}

/** Adapt a classified junction → the body SSoT input (mm, node at the origin). */
function toBodyInput(
  junction: PipeJunction,
  kind: MepFittingKind,
  classification: FittingClassification,
): FittingBodyInput {
  const base: FittingBodyInput = {
    kind,
    node: { x: 0, y: 0 },
    incidents: junction.incidents.map((inc) => ({
      dir: { x: inc.directionUnit.x, y: inc.directionUnit.y },
      diameter: inc.diameterMm,
    })),
    primaryDiameter: classification.primaryDiameterMm,
  };
  return classification.secondaryDiameterMm !== undefined
    ? { ...base, secondaryDiameter: classification.secondaryDiameterMm }
    : base;
}
