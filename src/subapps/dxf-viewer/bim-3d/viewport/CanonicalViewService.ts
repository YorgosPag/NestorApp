/**
 * Dispatch layer: CanonicalViewId → ViewportCamera action.
 * ADR-366 Phase 4.1 — single point of routing for all 12 canonical views.
 * ADR-366 Phase 4.2 — accepts optional AnimationManager for managed transitions.
 *
 * Ortho views  → viewport.setProjection(mode)   (animated via existing transition)
 * Iso views    → viewport.snapToViewDirection()  (perspective, 500ms cubic ease)
 * Home         → snapTo('iso-ne')               (A.5 decision: AutoCAD-style NE iso)
 */

import * as THREE from 'three';
import type { ViewportCamera, CanonicalViewId } from './viewport-types';
import { CANONICAL_VIEW_ENTRIES, HOME_CANONICAL_VIEW_ID, getCanonicalViewDef } from './canonical-views';
import type { AnimationManager } from './animation-manager';

export interface CanonicalViewService {
  /** Snap camera to the given canonical view ID, animated. */
  readonly snapTo: (id: CanonicalViewId) => void;
  /** Snap to home view (NE isometric — A.5 decision). */
  readonly snapHome: () => void;
}

// Reusable vector — only touched inside snapTo (single-threaded JS).
const _isoDir = new THREE.Vector3();

export function createCanonicalViewService(
  viewport: ViewportCamera,
  animationManager?: AnimationManager,
): CanonicalViewService {
  function snapTo(id: CanonicalViewId): void {
    const def = getCanonicalViewDef(id);
    if (!def) return;
    // Cancel any managed animation before starting a new viewport transition.
    animationManager?.cancel();
    if (def.type === 'ortho' && def.projectionMode) {
      viewport.setProjection(def.projectionMode);
    } else {
      // Camera-from-target = -lookDir (lookDir is camera-to-target).
      _isoDir.set(-def.lookDir[0], -def.lookDir[1], -def.lookDir[2]);
      viewport.snapToViewDirection(_isoDir);
    }
  }

  return {
    snapTo,
    snapHome: () => snapTo(HOME_CANONICAL_VIEW_ID),
  };
}
