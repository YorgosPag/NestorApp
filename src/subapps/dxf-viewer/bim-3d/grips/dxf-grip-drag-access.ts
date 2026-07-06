'use client';

/**
 * dxf-grip-drag-access — the ONE accessor for «which raw-DXF grip is being dragged + its entity» in the
 * 3D overlay dispatch (ADR-537/555).
 *
 * Three passes need the exact same resolution — the live-dragged grip (from the non-reactive interaction
 * singleton), guarded, plus its raw-DXF entity in the active floor scope: the ghost stroke
 * (`use-grip-pass`), the alignment traces (`use-grip-tracking-pass`) and the length/angle HUD
 * (`use-grip-hud-pass`). And two of them share the same low-frequency activation gate (a raw-DXF grip set
 * is seated). Both were copied per-pass; this module owns them once so the guards + the drag→entity
 * lookup can never drift between the three overlays.
 */

import { useSyncExternalStore } from 'react';
import type { GripInfo } from '../../hooks/grip-types';
import { useGrip3DOverlayStore, grip3DOverlayInteraction } from '../stores/Grip3DOverlayStore';
import { findDxfEntityInScope } from '../scene/dxf-3d-floor-scope';

/** The live-dragged raw-DXF grip, its resolved entity-in-scope, and the (non-null) drag state. */
export interface DraggedDxfGrip {
  readonly grip: GripInfo;
  readonly found: NonNullable<ReturnType<typeof findDxfEntityInScope>>;
  readonly drag: NonNullable<typeof grip3DOverlayInteraction.drag>;
}

/**
 * Resolve the currently-dragged raw-DXF grip + its entity, or `null` when nothing is in flight / the grip
 * has no source id / the entity is off the active floor scope. `grips` is the live grip set (the caller
 * already holds it). Reads the non-reactive drag singleton — call at paint time only (ADR-040).
 */
export function resolveDraggedDxfGrip(grips: readonly GripInfo[]): DraggedDxfGrip | null {
  const drag = grip3DOverlayInteraction.drag;
  if (!drag || grips.length === 0) return null;
  const grip = grips[drag.index % grips.length];
  if (!grip?.entityId) return null;
  const found = findDxfEntityInScope(grip.entityId);
  if (!found) return null;
  return { grip, found, drag };
}

/**
 * Low-frequency activation gate for the raw-DXF grip overlays: true while a raw-DXF grip set is seated
 * (`dxfGhostEntityIds` non-empty). Subscribes to the grip store; returns a primitive so React de-dupes
 * cleanly. Shared by the grip-tracking + grip-HUD passes (ADR-040 micro-leaf activation).
 */
export function useDxfGhostGripsActive(): boolean {
  return useSyncExternalStore(
    useGrip3DOverlayStore.subscribe,
    () => useGrip3DOverlayStore.getState().dxfGhostEntityIds.length > 0,
    () => useGrip3DOverlayStore.getState().dxfGhostEntityIds.length > 0,
  );
}
