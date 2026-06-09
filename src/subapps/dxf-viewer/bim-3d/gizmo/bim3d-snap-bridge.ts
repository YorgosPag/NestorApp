'use client';

/**
 * bim3d-snap-bridge.ts — pure snap-resolution helpers for the 3D BIM gizmo.
 *
 * ADR-402 (3D Viewport BIM Element Editing) — Phase B snap-during-drag.
 *
 * The pure `BimGizmoDragBridge` must stay free of scene / singleton deps, so it
 * takes an injected `SnapFn` (callback) instead of importing the snap engine.
 * This module builds those callbacks from the ONE snap engine SSoT
 * (`getGlobalSnapEngine()` → `ProSnapEngineV2`, structurally typed here as
 * `SnapQueryEngine` so the unit tests can pass a fake), reusing the existing
 * `findSnapPoint` — NO new snap logic.
 *
 * Two flavours, both returning the snap-corrected *primary control point* plus
 * the snap target (for the 3D marker):
 *   - move   → AutoCAD-style: any of the element's characteristic points (corners /
 *              endpoints / midpoints, fed as plan-mm offsets from the gizmo anchor)
 *              may "grab" a snap target; the nearest wins and the whole element
 *              shifts so that point lands exactly on the target.
 *   - resize → the dragged handle itself snaps to the nearest feature.
 *
 * Coordinates are DXF plan millimetres throughout (same space as `worldToDxfPlan`).
 */

import type { Point2D } from '../../rendering/types/Types';

/** A linear reference (wall face / axis / grid line) the snap projected onto, mm. */
export interface SnapAlignmentRef {
  readonly a: Point2D;
  readonly b: Point2D;
}

/** Snap-corrected primary control point + the snap target (for the marker). */
export interface SnapResolution {
  /** Corrected primary control point (gizmo anchor for move / handle for resize), mm. */
  readonly snappedMm: Point2D;
  /** The snap target in the scene that was hit, mm — drawn as the 3D snap marker. */
  readonly markerMm: Point2D;
  /**
   * ADR-363 Φ1G.5 Slice 2i — the linear reference the winning snap projected onto
   * (a wall face line, mm), for the Revit dashed alignment line. Absent for discrete
   * point snaps (endpoint / corner). Additive / back-compat.
   */
  readonly alignmentRef?: SnapAlignmentRef;
  /**
   * ADR-363 Φ1G.5 Slice 2i — the winning snap candidate's raw `description` (e.g.
   * 'bim-wall-face') + `type`, surfaced so the gizmo can show the Revit snap-type label
   * ("Παρειά τοίχου" / "Γωνία τοίχου"). Both optional / back-compat.
   */
  readonly snapDescription?: string;
  readonly snapType?: string;
}

/**
 * Snap callback injected into the pure bridge. Given the live (un-snapped) plan
 * position of the primary control point, returns the snap correction, or `null`
 * when nothing snaps (incl. OSNAP disabled). Pure from the bridge's point of view.
 */
export type SnapFn = (queryMm: Point2D) => SnapResolution | null;

/** The slice of `ProSnapEngineV2` the bridges need — kept minimal for testability. */
export interface SnapQueryEngine {
  findSnapPoint(
    cursorPoint: Point2D,
    excludeEntityId?: string,
  ): {
    found: boolean;
    // ADR-363 Φ1G.5 Slice 2i — `referenceSegment` (the linear reference the snap hit) +
    // `description`/`type` (for the snap-type label) are optional + ignored by point snaps,
    // so existing fakes/tests stay valid.
    snapPoint: {
      point: Point2D;
      referenceSegment?: { start: Point2D; end: Point2D };
      description?: string;
      type?: string;
      // ADR-363 Φ1G.5 Slice 2j — the candidate's snap priority (lower = stronger; corners −2,
      // wall-face 9.5, grid 12/13). Used to rank multi-grab probes so a high-priority face/corner
      // beats the omnipresent low-priority grid even when grid is geometrically nearer. Optional
      // → legacy fakes/tests (no priority) fall back to distance-only ranking.
      priority?: number;
    } | null;
  };
  getSettings(): { enabled: boolean };
}

/**
 * ADR-363 Φ1G.5 Slice 2j — priority used when a snap candidate omits one (legacy fakes /
 * tests). A neutral constant so every candidate ranks equal → ranking degrades to pure
 * distance, preserving the pre-2j behaviour for callers that don't surface priority.
 */
const DEFAULT_SNAP_PRIORITY = 0;

const sqDist = (a: Point2D, b: Point2D): number => {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
};

/**
 * Move snap (AutoCAD-style multi-grab). `charOffsetsMm` are the element's
 * characteristic points expressed as plan-mm offsets from the gizmo anchor,
 * captured once at drag start. For a candidate anchor position we probe the snap
 * engine at every characteristic point; the closest successful snap wins and the
 * anchor is shifted so that point lands exactly on the target.
 *
 * Returns `null` (no snap) when OSNAP is off or no characteristic point is within
 * the engine's tolerance — the bridge then keeps the free drag.
 */
export function makeMoveSnapFn(
  engine: SnapQueryEngine,
  charOffsetsMm: readonly Point2D[],
  excludeEntityId?: string,
): SnapFn {
  // `[{0,0}]` fallback (unknown type → no grips): snap the anchor itself.
  const offsets = charOffsetsMm.length > 0 ? charOffsetsMm : [{ x: 0, y: 0 }];
  return (anchorMm: Point2D): SnapResolution | null => {
    if (!engine.getSettings().enabled) return null;
    let best: {
      offset: Point2D; target: Point2D; d: number; prio: number;
      ref?: SnapAlignmentRef; description?: string; type?: string;
    } | null = null;
    for (const offset of offsets) {
      const probe = { x: anchorMm.x + offset.x, y: anchorMm.y + offset.y };
      const r = engine.findSnapPoint(probe, excludeEntityId);
      if (!r.found || !r.snapPoint) continue;
      const d = sqDist(probe, r.snapPoint.point);
      // ADR-363 Φ1G.5 Slice 2j — rank by PRIORITY first, then distance. The grid snap is
      // omnipresent so there is always a grid point ~0mm from *some* probe; ranking by raw
      // distance let it shadow every wall face/corner (Giorgio: the label only ever showed
      // "Πλέγμα"). Lower priority wins (corners −2 < wall-face 9.5 < grid 12/13), so a
      // geometry snap beats grid whenever one is in range; grid stays a fallback.
      const prio = r.snapPoint.priority ?? DEFAULT_SNAP_PRIORITY;
      // Slice 2i — surface the winning probe's linear reference (face line) for the dashed
      // alignment line, + its description/type for the snap-type label.
      const seg = r.snapPoint.referenceSegment;
      if (!best || prio < best.prio || (prio === best.prio && d < best.d)) {
        best = {
          offset, target: r.snapPoint.point, d, prio,
          ref: seg ? { a: seg.start, b: seg.end } : undefined,
          description: r.snapPoint.description,
          type: r.snapPoint.type,
        };
      }
    }
    if (!best) return null;
    return {
      snappedMm: { x: best.target.x - best.offset.x, y: best.target.y - best.offset.y },
      markerMm: best.target,
      ...(best.ref ? { alignmentRef: best.ref } : {}),
      ...(best.description ? { snapDescription: best.description } : {}),
      ...(best.type ? { snapType: best.type } : {}),
    };
  };
}

/**
 * Resize snap — the dragged handle (the primary control point) snaps directly to
 * the nearest feature, so the new face/edge "clicks" onto an existing line.
 */
export function makeResizeSnapFn(engine: SnapQueryEngine, excludeEntityId?: string): SnapFn {
  return (handleMm: Point2D): SnapResolution | null => {
    if (!engine.getSettings().enabled) return null;
    const r = engine.findSnapPoint(handleMm, excludeEntityId);
    if (!r.found || !r.snapPoint) return null;
    return { snappedMm: r.snapPoint.point, markerMm: r.snapPoint.point };
  };
}
