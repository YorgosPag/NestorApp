/**
 * ADR-650 M5α.2 — topography-QA flag → Three.js world position (pure, THREE-free).
 *
 * The sibling of `clash-marker-math`, but the survey domain needs three transforms where a clash
 * needed one, and each of them already has an owner elsewhere in ADR-650. This module does NOT
 * re-derive them — it applies the very same ones the terrain mesh applies, in the same order, so
 * a QA marker can never float off the hill it is flagging:
 *
 *   1. **WORLD ΕΓΣΑ → building-DISPLAY** (M10b) — via the caller's `WorldToDisplayProjector`, the
 *      same projector `tin-to-three` / `contour-to-three` receive. Without it the marker would sit
 *      at real ΕΓΣΑ magnitudes (~1e6 m) while the mesh sits under the building.
 *   2. **real WORLD Z − vertical datum** (M10c) — the same subtraction that seats the terrain
 *      vertically ON the building instead of at its true altitude.
 *   3. **plan-mm → three world (m, Y-up)** — the shared axis convention, never re-inlined.
 *
 * Pure by construction (no store reads): the impure caller resolves the projector + datum from the
 * SSoTs — exactly the split `tin-to-three` uses, and the reason a QA marker and the terrain mesh
 * cannot seat differently.
 *
 * @see ../converters/tin-to-three.ts — the same three transforms, for the surface itself
 * @see ../viewport/plan-to-world-math.ts — the axis convention
 * @see ../../systems/topography/qa/topo-qa-types.ts — `TopoQaFlag.atZMm`
 */

import type { Point2D } from '../../rendering/types/Types';
import type { WorldToDisplayProjector } from '../../systems/geo-referencing/geo-transform';
import { planMmToWorld, type WorldTriple } from '../viewport/plan-to-world-math';

/** The display inputs the conversion needs but must not read itself (mirror of `TinShadingOptions`). */
export interface TopoQaMarkerOptions {
  /** Active WORLD (ΕΓΣΑ) → building-DISPLAY projector. Omitted/identity → stay in world. */
  readonly projector?: WorldToDisplayProjector | null;
  /** Project vertical datum (WORLD canonical mm) subtracted from the flag's elevation. */
  readonly datumMm?: number;
}

/**
 * A QA flag's WORLD position (canonical mm) + its real WORLD elevation (canonical mm) → three-world
 * metres, or `null` when any coordinate is non-finite.
 *
 * The `null` is load-bearing, not defensive noise: a NaN here would place a DOM marker at
 * `translate(NaN, NaN)` — an invisible element the user reads as «the check found nothing there»,
 * which is the one thing a QA report must never imply. Hiding it is honest; drawing it at 0,0 is not.
 */
export function topoQaFlagToWorld(
  at: Point2D,
  elevationMm: number,
  options?: TopoQaMarkerOptions,
): WorldTriple | null {
  const projector = options?.projector ?? null;
  const project = projector && !projector.isIdentity ? projector : null; // fast path when unset/identity

  const plan = project ? project.project(at.x, at.y) : null;
  const planXMm = plan ? plan.x : at.x;
  const planYMm = plan ? plan.y : at.y;
  const elevMm = elevationMm - (options?.datumMm ?? 0);

  if (!Number.isFinite(planXMm) || !Number.isFinite(planYMm) || !Number.isFinite(elevMm)) return null;
  return planMmToWorld(planXMm, planYMm, elevMm);
}
