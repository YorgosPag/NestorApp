/**
 * GRIP MENU RESOLVER — ADR-349 Phase 1b.2 (SSoT)
 *
 * Pure mapping from `(Entity, UnifiedGripInfo)` → list of action IDs available
 * in the multifunctional grip hover menu. No React, no I/O, no commands —
 * pure metadata. Action binding & dispatch lives in `grip-menu-actions.ts`.
 *
 * ## Revit-grade rule (ADR-397, Giorgio 2026-06-17)
 * Dragging a grip IS already the stretch — Revit/AutoCAD never surface a
 * redundant «Stretch» entry on hover. So the hover menu lists ONLY the genuine
 * *multifunctional* actions that the drag cannot express on its own. A grip
 * with no such action (column/BIM anchors, circle/text, line midpoint, arc
 * center, whole-entity MOVE glyph) returns `[]` → no menu pops at all.
 *
 * Industry rules (AutoCAD / BricsCAD / progeCAD / GstarCAD / nanoCAD), minus
 * the implicit Stretch:
 *  - LINE endpoint → Lengthen
 *  - POLYLINE / LWPOLYLINE vertex → Add Vertex, Remove Vertex
 *  - ARC endpoint → Lengthen
 *  - ARC midpoint → Radius
 *  - everything else (anchors, midpoints, MOVE glyph) → (no menu)
 *
 * @see ADR-349 §Multifunctional Grip Menu
 * @see ADR-397 §BIM grip glyph behaviour
 */

import type { UnifiedGripInfo } from '../../hooks/grips/unified-grip-types';
import type { Entity } from '../../types/entities';

export type GripMenuActionId =
  | 'lengthen'
  | 'addVertex'
  | 'removeVertex'
  | 'radius';

export interface GripMenuActionMeta {
  readonly id: GripMenuActionId;
  /** Translation key under `tool-hints:gripMenu.*` */
  readonly labelKey: string;
}

const META: Readonly<Record<GripMenuActionId, GripMenuActionMeta>> = {
  lengthen:     { id: 'lengthen',     labelKey: 'gripMenu.lengthen' },
  addVertex:    { id: 'addVertex',    labelKey: 'gripMenu.addVertex' },
  removeVertex: { id: 'removeVertex', labelKey: 'gripMenu.removeVertex' },
  radius:       { id: 'radius',       labelKey: 'gripMenu.radius' },
};

function isLineEndpoint(grip: UnifiedGripInfo): boolean {
  return grip.type === 'vertex' && (grip.gripIndex === 0 || grip.gripIndex === 1);
}

function isArcEndpoint(grip: UnifiedGripInfo): boolean {
  return grip.type === 'vertex' && (grip.gripIndex === 1 || grip.gripIndex === 2);
}

function isArcMidpoint(grip: UnifiedGripInfo): boolean {
  return grip.type === 'edge' && grip.gripIndex === 3;
}

function isPolylineVertex(grip: UnifiedGripInfo, vertexCount: number): boolean {
  return grip.type === 'vertex' && grip.gripIndex >= 0 && grip.gripIndex < vertexCount;
}

/**
 * Resolve the multifunctional action set for a grip on a given entity.
 * Returns an ordered list (possibly empty). Stretch is implicit in the drag
 * and is never listed — an empty result means no hover menu pops.
 */
export function resolveMenuActions(entity: Entity, grip: UnifiedGripInfo): GripMenuActionMeta[] {
  // ADR-397 — whole-entity MOVE grips (the 4-arrow glyph: column-center,
  // wall-midpoint, beam-midpoint, *-move on every BIM entity) carry NO hover menu.
  // The 4-arrow handle owns directional move on click.
  if (grip.movesEntity) return [];

  switch (entity.type) {
    case 'line':
      return isLineEndpoint(grip) ? [META.lengthen] : [];

    case 'arc':
      if (isArcMidpoint(grip)) return [META.radius];
      if (isArcEndpoint(grip)) return [META.lengthen];
      return [];

    case 'polyline':
    case 'lwpolyline': {
      const vertices = (entity as { vertices: ReadonlyArray<unknown> }).vertices;
      const vLen = vertices?.length ?? 0;
      if (isPolylineVertex(grip, vLen)) {
        const canRemove = vLen > 2;
        return canRemove
          ? [META.addVertex, META.removeVertex]
          : [META.addVertex];
      }
      return [];
    }

    // column / BIM anchors, circle / ellipse / text / point → drag-only, no menu.
    default:
      return [];
  }
}
