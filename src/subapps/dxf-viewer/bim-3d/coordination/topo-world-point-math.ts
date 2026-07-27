/**
 * ADR-650 M5α.2 / M8β/Γ — survey WORLD point → Three.js world position (pure, THREE-free).
 *
 * The sibling of `clash-marker-math`, but the survey domain needs three transforms where a clash
 * needed one, and each of them already has an owner elsewhere in ADR-650. This module does NOT
 * re-derive them — it applies the very same ones the terrain mesh applies, in the same order, so
 * nothing seated through here can float off the hill it belongs to:
 *
 *   1. **WORLD ΕΓΣΑ → building-DISPLAY** (M10b) — via the caller's `WorldToDisplayProjector`, the
 *      same projector `tin-to-three` / `contour-to-three` receive. Without it the point would sit
 *      at real ΕΓΣΑ magnitudes (~1e6 m) while the mesh sits under the building.
 *   2. **real WORLD Z − vertical datum** (M10c) — the same subtraction that seats the terrain
 *      vertically ON the building instead of at its true altitude.
 *   3. **plan-mm → three world (m, Y-up)** — the shared axis convention, never re-inlined.
 *
 * Pure by construction (no store reads): the impure callers resolve the projector + datum from the
 * SSoTs — exactly the split `tin-to-three` uses, and the reason a marker and the terrain mesh
 * cannot seat differently.
 *
 * ### Why it is not named after QA any more
 * It shipped as `topo-qa-marker-math.topoQaFlagToWorld` because a QA flag was the only caller.
 * Nothing in it is QA-specific — it takes a plan point and an elevation — and the auto-breakline
 * review (M8β/Γ) needed the identical chain for its candidates. Adding a second module would have
 * duplicated a transform where a single flipped sign is invisible in review and shows up as
 * geometry mirrored across the site, so the module was renamed to what it actually is.
 *
 * @see ../converters/tin-to-three.ts — the same three transforms, for the surface itself
 * @see ../viewport/plan-to-world-math.ts — the axis convention
 * @see ./topo-qa-flag-world.ts — the QA impure resolver
 * @see ./auto-breakline-world.ts — the auto-breakline impure resolver
 */

import type { Point2D } from '../../rendering/types/Types';
import type { WorldToDisplayProjector } from '../../systems/geo-referencing/geo-transform';
import { planMmToWorld, type WorldTriple } from '../viewport/plan-to-world-math';

/** The display inputs the conversion needs but must not read itself (mirror of `TinShadingOptions`). */
export interface TopoWorldPointOptions {
  /** Active WORLD (ΕΓΣΑ) → building-DISPLAY projector. Omitted/identity → stay in world. */
  readonly projector?: WorldToDisplayProjector | null;
  /** Project vertical datum (WORLD canonical mm) subtracted from the point's elevation. */
  readonly datumMm?: number;
}

/**
 * A survey WORLD position (canonical mm) + its real WORLD elevation (canonical mm) → three-world
 * metres, or `null` when any coordinate is non-finite.
 *
 * The `null` is load-bearing, not defensive noise: a NaN here would place a DOM marker at
 * `translate(NaN, NaN)` — an invisible element the user reads as «the check found nothing there»,
 * which is the one thing a review overlay must never imply. Hiding it is honest; drawing it at 0,0
 * is not.
 */
export function topoWorldPointToThree(
  at: Point2D,
  elevationMm: number,
  options?: TopoWorldPointOptions,
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
