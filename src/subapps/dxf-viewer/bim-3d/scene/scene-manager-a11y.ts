/**
 * scene-manager-a11y — keyboard-focus accessibility logic extracted from
 * ThreeJsSceneManager (ADR-366 Phase 4.5 / A.7.Q1). Pure free functions so the
 * manager keeps thin delegating wrappers and stays under the 500-line SRP limit.
 */

import type * as THREE from 'three';
import { computeFocusOrder } from '../accessibility/focus-order';
import type { KeyboardFocusManagerApi } from '../accessibility/KeyboardFocusManager';
import { useSelection3DStore } from '../stores/Selection3DStore';

/** A.7.Q1 — Tab/Shift+Tab cycle through the visible entities in frustum order. */
export function cycleKeyboardFocus(
  group: THREE.Object3D,
  camera: THREE.Camera,
  manager: KeyboardFocusManagerApi,
  direction: 'next' | 'prev',
): void {
  manager.setOrder(computeFocusOrder(group, camera));
  if (direction === 'next') manager.next();
  else manager.prev();
}

/** A.7.Q1 — Enter on the focused entity → toggle its selection (ADR-030 integration). */
export function selectFocusedEntity(
  manager: KeyboardFocusManagerApi,
  toggleSelection: (bimId: string | null) => void,
): void {
  const focusedId = manager.getFocused();
  if (!focusedId) return;
  const currentSelected = useSelection3DStore.getState().selectedBimId;
  toggleSelection(currentSelected === focusedId ? null : focusedId);
}
