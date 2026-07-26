/**
 * dxf-overlay-resync — scope-aware SSoT for rebuilding the 3D DXF floor-plan
 * underlay, mirroring {@link bim3d-resync} for the BIM scene.
 *
 * ADR-399 Phase B. The DXF wireframe overlay used to render only the active
 * floor (at Y=0), so the «Όλοι οι όροφοι» 3D view showed just one floor's plan
 * while the BIM geometry stacked correctly. This helper makes every overlay
 * trigger honour `floor3DScope`:
 *   'all'    → `syncDxfOverlayMultiFloor(stack)` (every floor at its elevation),
 *   'single' → `syncDxfOverlay(activeScene, storeyFFL)` (ADR-399 Φάση Ε).
 *
 * ADR-399 Φάση Ε — the single-floor branch no longer derives ANYTHING itself: it renders exactly
 * the entry {@link getDxfFloorScope} reports, which is the very same entry the pick / hover /
 * grip / marquee path consumes. One source for «which plane, at what Y» ⇒ render and pick cannot
 * drift apart (the old pair of independently-hardcoded zeros was how they silently did).
 *
 * Reads stores synchronously via `getState()` so it is safe to call from the
 * non-React store subscribers (DxfOverlay3DStore / scope / stack / active storey).
 */

import { useViewMode3DStore } from '../stores/ViewMode3DStore';
import { getMultiFloorDxfStack } from './multi-floor-dxf-source';
import { getDxfFloorScope } from './dxf-3d-floor-scope';
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
  // Single scope → exactly one entry (or none when no plan is loaded → `sync(null)` disposes).
  const [floor] = getDxfFloorScope();
  manager.syncDxfOverlay(floor?.scene ?? null, floor?.floorElevationMm ?? 0);
}
