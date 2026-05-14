/**
 * GRIP MENU RESOLVER — ADR-349 Phase 1b.2 (SSoT)
 *
 * Pure mapping from `(Entity, UnifiedGripInfo)` → list of action IDs available
 * in the multifunctional grip hover menu. No React, no I/O, no commands —
 * pure metadata. Action binding & dispatch lives in `grip-menu-actions.ts`.
 *
 * Industry rules (AutoCAD / BricsCAD / progeCAD / GstarCAD / nanoCAD):
 *  - LINE endpoint → Stretch, Lengthen
 *  - LINE midpoint → Stretch
 *  - POLYLINE / LWPOLYLINE vertex → Stretch, Add Vertex, Remove Vertex
 *  - POLYLINE / LWPOLYLINE edge midpoint → Stretch
 *  - ARC endpoint → Stretch, Lengthen
 *  - ARC midpoint → Stretch, Radius
 *  - ARC center → Stretch (== MOVE)
 *  - CIRCLE / ELLIPSE / TEXT / INSERT / POINT anchor → Stretch (== MOVE)
 *
 * @see ADR-349 §Multifunctional Grip Menu
 */

import type { UnifiedGripInfo } from '../../hooks/grips/unified-grip-types';
import type { Entity } from '../../types/entities';

export type GripMenuActionId =
  | 'stretch'
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
  stretch:      { id: 'stretch',      labelKey: 'gripMenu.stretch' },
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
 * Resolve the action set for a grip on a given entity.
 * Returns ordered list — first entry is the default (Stretch).
 */
export function resolveMenuActions(entity: Entity, grip: UnifiedGripInfo): GripMenuActionMeta[] {
  const stretch = META.stretch;

  switch (entity.type) {
    case 'line':
      return isLineEndpoint(grip) ? [stretch, META.lengthen] : [stretch];

    case 'arc':
      if (isArcMidpoint(grip)) return [stretch, META.radius];
      if (isArcEndpoint(grip)) return [stretch, META.lengthen];
      return [stretch];

    case 'polyline':
    case 'lwpolyline': {
      const vertices = (entity as { vertices: ReadonlyArray<unknown> }).vertices;
      const vLen = vertices?.length ?? 0;
      if (isPolylineVertex(grip, vLen)) {
        const canRemove = vLen > 2;
        return canRemove
          ? [stretch, META.addVertex, META.removeVertex]
          : [stretch, META.addVertex];
      }
      return [stretch];
    }

    case 'circle':
    case 'ellipse':
    case 'text':
    case 'point':
    default:
      return [stretch];
  }
}
