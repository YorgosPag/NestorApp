/**
 * dxf-overlay-resync — scope-aware SSoT for rebuilding the 3D DXF floor-plan
 * underlay, mirroring {@link bim3d-resync} for the BIM scene.
 *
 * ADR-399 Phase B. The DXF wireframe overlay used to render only the active
 * floor (at Y=0), so the «Όλοι οι όροφοι» 3D view showed just one floor's plan
 * while the BIM geometry stacked correctly. This helper makes every overlay
 * trigger honour `floor3DScope`:
 *   'all'    → `syncDxfOverlayMultiFloor(stack)` (every floor at its elevation),
 *   'single' → `syncDxfOverlay(activeScene)` (legacy single-floor behaviour).
 *
 * Reads stores synchronously via `getState()` so it is safe to call from the
 * non-React store subscribers (DxfOverlay3DStore / scope / stack).
 */

import { useViewMode3DStore } from '../stores/ViewMode3DStore';
import { useDxfOverlay3DStore } from '../stores/DxfOverlay3DStore';
import { getMultiFloorDxfStack } from './multi-floor-dxf-source';
import type { ThreeJsSceneManager } from './ThreeJsSceneManager';

/**
 * Rebuild the DXF overlay for `manager` honouring the active `floor3DScope`.
 * No-op when `manager` is null. The read-only Properties pipeline never enters
 * the 'all' scope (no floor tab bar), so a scope flag is enough here.
 */
export function resyncDxfOverlay(manager: ThreeJsSceneManager | null): void {
  if (!manager) return;
  if (useViewMode3DStore.getState().floor3DScope === 'all') {
    manager.syncDxfOverlayMultiFloor(getMultiFloorDxfStack());
    return;
  }
  manager.syncDxfOverlay(useDxfOverlay3DStore.getState().dxfScene);
}
