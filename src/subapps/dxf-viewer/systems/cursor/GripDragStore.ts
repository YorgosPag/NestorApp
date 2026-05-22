/**
 * GripDragStore — Imperative store for active grip drag context
 *
 * Pattern identical to ImmediateSnapStore: zero-React, mutable singleton.
 * Written by useUnifiedGripInteraction on drag start/end.
 * Read by mouse-handler-move + mouse-handler-up for face corner projection snap.
 *
 * ADR-371 extension: Wall Face Corner Projection Snap
 */

export interface ActiveDragGripInfo {
  entityId: string;
  gripKind: string | null; // 'wall-start' | 'wall-end' | 'wall-midpoint' | etc.
}

let activeDragGrip: ActiveDragGripInfo | null = null;

/** Write — called by useUnifiedGripInteraction when DXF grip drag starts */
export function setActiveDragGrip(info: ActiveDragGripInfo): void {
  activeDragGrip = info;
}

/** Read — called by mouse handlers to know which grip is being dragged */
export function getActiveDragGrip(): ActiveDragGripInfo | null {
  return activeDragGrip;
}

/** Clear — called by resetToIdle in useUnifiedGripInteraction */
export function clearActiveDragGrip(): void {
  activeDragGrip = null;
}
