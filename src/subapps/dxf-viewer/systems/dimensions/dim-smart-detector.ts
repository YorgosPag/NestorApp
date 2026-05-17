/**
 * ADR-362 Phase C2 — Smart DIM auto-detection engine (D4).
 *
 * Pure function `detectDimensionType` that suggests the most-appropriate
 * `DimensionType` for the current creation context. Mirrors AutoCAD 2016+
 * `DIM` Smart command + Revit AutoDIM behaviour:
 *
 *   - Hover line → `'linear'` (axis-aligned) / `'aligned'` (oblique)
 *   - Hover circle → `'diameter'`
 *   - Hover arc → `'radius'`
 *   - Hover polyline edge → `'aligned'` (along that edge)
 *   - Click 1 line, hover a different line → `'angular2L'`
 *
 * 4-tier precedence (highest wins):
 *
 *   1. **manualOverride** — user explicitly picked a type from the ribbon
 *      dropdown. Detector returns it verbatim, ignores everything else.
 *   2. **spacePressCount** (mod-N) — Spacebar cycles through ALL valid types
 *      for the current hover (ADR-362 D4: "Spacebar — switch type").
 *   3. **tabPressCount** (mod-2) — Tab toggles between base and the binary
 *      alternative (ADR-362 D4: "Tab — Linear↔Aligned", and analogously
 *      arc → radius↔arcLength, circle → diameter↔radius).
 *   4. **post-click upgrade** — if `firstClickedEntity` is a line and the
 *      current hover is a different line, upgrade to `'angular2L'`.
 *
 * `shift` / `ctrl` are intentionally NOT detector inputs — per ADR-362 D4
 * they belong to the drawing pipeline (orthogonal constraint, snap override).
 *
 * Pure: no React, no stores, no time, no I/O. All cycle state is supplied via
 * counters by the caller (Phase D1 `useDimensionCreate` hook).
 */

import type { Point2D } from '../../rendering/types/Types';
import type {
  ArcEntity,
  CircleEntity,
  LineEntity,
  LWPolylineEntity,
  PolylineEntity,
} from '../../types/entities';
import type { DimensionType } from '../../types/dimension';

// ──────────────────────────────────────────────────────────────────────────────
// Public input/output
// ──────────────────────────────────────────────────────────────────────────────

/** Entities the detector recognises as "dim-able" hover targets. */
export type DetectableEntity =
  | LineEntity
  | CircleEntity
  | ArcEntity
  | PolylineEntity
  | LWPolylineEntity;

export interface DetectionContext {
  /** Cursor position in world coordinates (used for polyline edge selection). */
  readonly cursorWorld: Point2D;
  /** Entity currently under the cursor (snap/hover hit-test result). */
  readonly hoveredEntity?: DetectableEntity;
  /** First entity already picked in the creation flow (drives angular upgrade). */
  readonly firstClickedEntity?: DetectableEntity;
  /** Spacebar press count for the current creation session (mod-N cycle). */
  readonly spacePressCount?: number;
  /** Tab press count for the current creation session (mod-2 binary toggle). */
  readonly tabPressCount?: number;
  /** Ribbon dropdown explicit selection — overrides every other tier. */
  readonly manualOverride?: DimensionType;
}

// ──────────────────────────────────────────────────────────────────────────────
// Cycle / toggle tables
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Full Spacebar cycle per hovered entity kind — index 0 is the base
 * suggestion, subsequent entries are the cycle order. Tab toggles between
 * index 0 and index 1 (binary). Keep ordering deterministic so tests can
 * pin the expected sequence.
 */
const SPACE_CYCLE: Readonly<Record<string, readonly DimensionType[]>> = {
  line: ['linear', 'aligned'],
  circle: ['diameter', 'radius'],
  arc: ['radius', 'arcLength', 'diameter'],
  polyline: ['aligned', 'linear'],
  lwpolyline: ['aligned', 'linear'],
};

/** When `firstClickedEntity` is a line + hover is a different line. */
const ANGULAR_UPGRADE: DimensionType = 'angular2L';

// ──────────────────────────────────────────────────────────────────────────────
// Entry point
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Determine the recommended `DimensionType` for the current creation context.
 * Returns `null` when no recommendation is possible (no hover, unknown entity).
 */
export function detectDimensionType(ctx: DetectionContext): DimensionType | null {
  // Tier 1: explicit manual override wins everything.
  if (ctx.manualOverride) return ctx.manualOverride;

  // Tier 4 (lowest): hover base type. Bail when there's nothing to dim.
  const baseType = baseTypeFromHover(ctx);
  if (!baseType) return null;

  // Tier 4 upgrade: post-click angular if line→line transition.
  const postClick = applyPostClickUpgrade(baseType, ctx);

  // Tier 2 + Tier 3 modifiers (space > tab).
  return applyCycleAndToggle(postClick, ctx);
}

// ──────────────────────────────────────────────────────────────────────────────
// Tier helpers
// ──────────────────────────────────────────────────────────────────────────────

function baseTypeFromHover(ctx: DetectionContext): DimensionType | null {
  const e = ctx.hoveredEntity;
  if (!e) return null;
  switch (e.type) {
    case 'line':
      return isAxisAligned(e.start, e.end) ? 'linear' : 'aligned';
    case 'circle':
      return 'diameter';
    case 'arc':
      return 'radius';
    case 'polyline':
    case 'lwpolyline':
      return polylineBaseType(e, ctx.cursorWorld);
    default: {
      const _exhaustive: never = e;
      void _exhaustive;
      return null;
    }
  }
}

function applyPostClickUpgrade(base: DimensionType, ctx: DetectionContext): DimensionType {
  const clicked = ctx.firstClickedEntity;
  const hovered = ctx.hoveredEntity;
  if (!clicked || !hovered) return base;
  if (clicked.type !== 'line' || hovered.type !== 'line') return base;
  // Same line under cursor again → user is positioning, not picking a 2nd line.
  if (sameEntityId(clicked, hovered)) return base;
  return ANGULAR_UPGRADE;
}

function applyCycleAndToggle(after: DimensionType, ctx: DetectionContext): DimensionType {
  // Angular upgrade isn't part of any cycle — keep it stable under modifiers.
  if (after === ANGULAR_UPGRADE) return after;

  const cycleKey = hoverCycleKey(ctx.hoveredEntity);
  if (!cycleKey) return after;
  const cycle = SPACE_CYCLE[cycleKey];
  if (!cycle || cycle.length === 0) return after;

  // Tier 2: Space cycle through all (mod cycle length).
  if (ctx.spacePressCount && ctx.spacePressCount > 0) {
    const baseIdx = cycle.indexOf(after);
    const startIdx = baseIdx >= 0 ? baseIdx : 0;
    const idx = (startIdx + ctx.spacePressCount) % cycle.length;
    return cycle[idx];
  }

  // Tier 3: Tab binary toggle (only when there's an alternative).
  if (ctx.tabPressCount && ctx.tabPressCount > 0 && cycle.length >= 2) {
    const odd = (ctx.tabPressCount & 1) === 1;
    if (!odd) return after;
    const baseIdx = cycle.indexOf(after);
    const idx = baseIdx >= 0 ? (baseIdx + 1) % cycle.length : 1;
    return cycle[idx];
  }

  return after;
}

function hoverCycleKey(e: DetectableEntity | undefined): string | null {
  if (!e) return null;
  switch (e.type) {
    case 'line': return 'line';
    case 'circle': return 'circle';
    case 'arc': return 'arc';
    case 'polyline': return 'polyline';
    case 'lwpolyline': return 'lwpolyline';
    default: {
      const _exhaustive: never = e;
      void _exhaustive;
      return null;
    }
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// Geometry primitives (kept private — pure math)
// ──────────────────────────────────────────────────────────────────────────────

/** Tolerance for "axis-aligned" classification. tan(5°) ≈ 0.0875. */
const AXIS_TOLERANCE = Math.tan((5 * Math.PI) / 180);

function isAxisAligned(a: Point2D, b: Point2D): boolean {
  const dx = Math.abs(b.x - a.x);
  const dy = Math.abs(b.y - a.y);
  if (dx < 1e-9 && dy < 1e-9) return true; // zero-length line — degenerate
  if (dy < 1e-9) return true;
  if (dx < 1e-9) return true;
  // Horizontal-ish or vertical-ish within ±5°.
  return dy / dx < AXIS_TOLERANCE || dx / dy < AXIS_TOLERANCE;
}

function polylineBaseType(
  e: PolylineEntity | LWPolylineEntity,
  cursor: Point2D,
): DimensionType | null {
  if (!e.vertices || e.vertices.length < 2) return null;
  const edge = nearestEdge(e.vertices, cursor);
  if (!edge) return null;
  return isAxisAligned(edge.a, edge.b) ? 'linear' : 'aligned';
}

interface Edge {
  readonly a: Point2D;
  readonly b: Point2D;
}

function nearestEdge(vertices: readonly Point2D[], cursor: Point2D): Edge | null {
  let best: Edge | null = null;
  let bestDist = Infinity;
  for (let i = 0; i < vertices.length - 1; i++) {
    const a = vertices[i];
    const b = vertices[i + 1];
    const d = distancePointToSegment(cursor, a, b);
    if (d < bestDist) {
      bestDist = d;
      best = { a, b };
    }
  }
  return best;
}

function distancePointToSegment(p: Point2D, a: Point2D, b: Point2D): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq < 1e-12) {
    return Math.hypot(p.x - a.x, p.y - a.y);
  }
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  const projX = a.x + t * dx;
  const projY = a.y + t * dy;
  return Math.hypot(p.x - projX, p.y - projY);
}

function sameEntityId(a: DetectableEntity, b: DetectableEntity): boolean {
  return a.id === b.id;
}
