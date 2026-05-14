/**
 * STRETCH CROSSING CAPTURE — ADR-349 SSoT
 *
 * Single source of truth for vertex-in-window evaluation.
 * Accepts an array of axis-aligned crossing windows (1 for STRETCH, ≥1 for MSTRETCH)
 * and returns the union of captured vertices + whole-entity captures.
 *
 * @see ADR-349 §Crossing Window Capture
 */

import type { Point2D } from '../../rendering/types/Types';
import type { Entity } from '../../types/entities';
import type { CrossingWindow } from './StretchToolStore';
import {
  enumerateVertices,
  getAnchorPoint,
  getVertexPosition,
  type VertexRef,
} from './stretch-vertex-classifier';

export interface CrossingCaptureResult {
  readonly capturedVertices: ReadonlyArray<VertexRef>;
  /** Entity IDs whose anchor is inside any window → rigid translation */
  readonly capturedEntities: ReadonlyArray<string>;
}

/**
 * Capture all vertices and anchor-bound entities falling inside any of the
 * provided crossing windows. Locked entities are skipped at the caller level.
 *
 * @param entities    Entities to evaluate (caller pre-filters by layer-lock)
 * @param windows     One or more axis-aligned crossing windows (union semantics)
 */
export function captureCrossing(
  entities: ReadonlyArray<Entity>,
  windows: ReadonlyArray<CrossingWindow>,
): CrossingCaptureResult {
  if (windows.length === 0) {
    return { capturedVertices: [], capturedEntities: [] };
  }

  const capturedVertices: VertexRef[] = [];
  const capturedEntities: string[] = [];

  for (const entity of entities) {
    const refs = enumerateVertices(entity);

    if (refs.length === 0) {
      const anchor = getAnchorPoint(entity);
      if (anchor && pointInAnyWindow(anchor, windows)) {
        capturedEntities.push(entity.id);
      }
      continue;
    }

    for (const ref of refs) {
      const pos = getVertexPosition(entity, ref);
      if (pos && pointInAnyWindow(pos, windows)) {
        capturedVertices.push(ref);
      }
    }
  }

  return { capturedVertices, capturedEntities };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function pointInAnyWindow(p: Point2D, windows: ReadonlyArray<CrossingWindow>): boolean {
  for (const w of windows) {
    if (p.x >= w.min.x && p.x <= w.max.x && p.y >= w.min.y && p.y <= w.max.y) {
      return true;
    }
  }
  return false;
}

/**
 * Returns true when a screen-space drag is right-to-left (crossing-window mode).
 * Industry standard: left-to-right = window selection (whole-inclusion),
 * right-to-left = crossing selection (any-intersection).
 */
export function isCrossingDrag(startX: number, endX: number): boolean {
  return endX < startX;
}

/**
 * Builds a normalized axis-aligned window from two diagonal corners.
 */
export function makeWindow(p1: Point2D, p2: Point2D): CrossingWindow {
  return {
    min: { x: Math.min(p1.x, p2.x), y: Math.min(p1.y, p2.y) },
    max: { x: Math.max(p1.x, p2.x), y: Math.max(p1.y, p2.y) },
  };
}
