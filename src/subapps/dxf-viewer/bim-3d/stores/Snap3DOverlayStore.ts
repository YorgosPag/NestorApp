/**
 * Snap3DOverlayStore — state for the 3D snap-marker overlay (ADR-542).
 *
 * When the cursor hovers a BIM characteristic point (column corner / edge midpoint / centroid…)
 * in the 3D viewport, `use-bim3d-pointer-handlers` runs the ONE global snap engine
 * (`getGlobalSnapEngine`, same engine + same `bim-characteristic-points` as the 2D canvas) and
 * publishes the result here. `BimSnapIndicatorOverlay3D` subscribes to start/stop its RAF and
 * re-projects the stored plan point through the live camera each frame.
 *
 * Low-frequency by nature (updated at the hover-hittest throttle, ~50ms — NOT per frame), so a
 * small zustand store is the right home (mirror `Grip3DOverlayStore`). The marker's per-frame
 * screen position is derived imperatively in the overlay RAF, never stored.
 */

import { create } from 'zustand';
import type { SnapIndicatorView } from '../../snapping/extended-types';

/**
 * The active 3D snap marker: the 2D-shared view-model (`point` in DXF-plan mm, `type`,
 * `description`) + the elevation (mm) to lift the plan point to in 3D so the marker sits on
 * the surface under the cursor (the front-most raycast hit's elevation).
 */
export interface Snap3DMarker {
  readonly view: SnapIndicatorView;
  readonly elevMm: number;
}

interface Snap3DOverlayState {
  /** The active snap marker, or null when no characteristic point is under the cursor. */
  readonly snap: Snap3DMarker | null;
  /** Publish the active snap marker (hover hit), or null to clear (miss / OSNAP off / leave). */
  setSnap(snap: Snap3DMarker | null): void;
}

export const useSnap3DOverlayStore = create<Snap3DOverlayState>((set) => ({
  snap: null,
  setSnap: (snap) => set({ snap }),
}));
