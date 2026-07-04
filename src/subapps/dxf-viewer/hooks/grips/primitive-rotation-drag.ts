/**
 * ADR-561 — Live PRIMITIVE ROTATION drag SSoT (arc / polyline / rectangle / …).
 *
 * The SINGLE source of truth for «what does a primitive look like while its rotation
 * handle is dragged». It is the PREVIEW twin of the commit's `resolveRotation`
 * (`grip-primitive-rotate-commits.ts`): both compute the anchor-relative swept angle
 * with the SAME `sweptAngleDegAboutPivot`, and both apply the geometry with the SAME
 * `rotateEntity` (`utils/rotation-math.ts`) — the ONE rotate engine the canonical
 * `RotateEntityCommand` runs. So the live ghost is LITERALLY the committed transform,
 * not a per-primitive re-implementation kept «in parity» by hand.
 *
 * Before this module each primitive shipped its own `apply<Kind>RotationDrag` that
 * re-mapped `rotatePoint` over its geometry — a verbatim copy of the matching
 * `rotateEntity` case (arc: centre + angles· polyline: every vertex). Those copies are
 * gone: the arc + polyline ghost branches in `apply-entity-preview.ts` now call this.
 *
 * The `line` rotation is intentionally NOT routed here — it delegates to the shared
 * `axis-box` rotate engine (`applyAxisBoxGripDrag('rotation', …)`, the SAME one the
 * wall / beam / column use), so it stays in that family's SSoT rather than forking to
 * `rotateEntity`. One primitive, one engine — just a different (also-centralized) one.
 *
 * Zero React / DOM / Firestore / canvas deps.
 *
 * @see utils/rotation-math.ts — `rotateEntity` (the ONE rotate engine, commit + preview)
 * @see bim/grips/grip-math.ts — `sweptAngleDegAboutPivot` (the swept-angle SSoT)
 * @see hooks/grips/grip-primitive-rotate-commits.ts — `resolveRotation` (the commit twin)
 * @see docs/centralized-systems/reference/adrs/ADR-561-move-rotate-grips-primitives.md
 */

import type { Point2D } from '../../rendering/types/Types';
import type { Entity } from '../../types/entities';
import { sweptAngleDegAboutPivot } from '../../bim/grips/grip-math';
import { rotateEntity } from '../../utils/rotation-math';

/**
 * The guarded anchor-relative swept angle (degrees, +CCW) shared by the rotation
 * PREVIEW (ghost) and COMMIT paths. `null` on a degenerate OR a zero sweep (cursor on
 * the pivot) so both callers no-op identically. The ONE place the `=== 0` no-op guard
 * lives, on top of the `sweptAngleDegAboutPivot` SSoT.
 */
export function resolveSweptRotationDeg(
  pivot: Point2D,
  anchor: Point2D,
  currentPos: Point2D,
): number | null {
  const deg = sweptAngleDegAboutPivot(pivot, anchor, currentPos);
  return deg === null || deg === 0 ? null : deg;
}

/** The minimal drag context a live primitive rotation ghost reads. */
export interface PrimitiveRotationDragInput {
  /** Reference anchor at mouseDown — the swept angle is anchor-relative. */
  readonly anchor: Point2D;
  /** Live world cursor position (= anchor + delta). */
  readonly currentPos: Point2D;
  /** Rotation centre (the picked hot-grip pivot; callers resolve the per-entity fallback). */
  readonly pivot: Point2D;
}

/**
 * Rotate ANY primitive about the pivot by the anchor-relative swept angle, returning the
 * `rotateEntity` patch (e.g. `{ vertices }` for a polyline, `{ center, startAngle, endAngle }`
 * for an arc) — or `null` for a degenerate / zero sweep. The geometry is delegated to the
 * SAME `rotateEntity` the commit runs, so preview ≡ commit by identity (not parity). Callers
 * spread the patch onto the cloned entity for the ghost.
 */
export function applyPrimitiveRotationDrag(
  entity: Entity,
  input: PrimitiveRotationDragInput,
): Partial<Entity> | null {
  const sweptDeg = resolveSweptRotationDeg(input.pivot, input.anchor, input.currentPos);
  if (sweptDeg === null) return null;
  return rotateEntity(entity, input.pivot, sweptDeg);
}
