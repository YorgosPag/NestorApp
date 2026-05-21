// ============================================================================
// ♿ KEYBOARD FOCUS 2D MANAGER — Module Singleton (ADR-366 Phase 4.6 / A.7.Q1 2D)
// ============================================================================
//
// Wraps the cross-mode `KeyboardFocusManager` SSoT (Phase 4.5, originally
// shipped under `bim-3d/accessibility/`) as a module-level singleton scoped to
// the 2D DXF viewport. One instance lives for the lifetime of the page —
// matches the existing module-level pattern used by 2D stores (HoverStore,
// ImmediatePositionStore, GuideStore).
//
// Cross-mode isolation: a separate instance lives inside `ThreeJsSceneManager`
// for the 3D viewport. Mode switches in either direction clear the inactive
// manager's focus; this is the caller's responsibility (see `use2DKeyboardFocus`
// for the 2D side, `ThreeJsSceneManager.dispose()` for the 3D side).
// ============================================================================

import {
  createKeyboardFocusManager,
  type KeyboardFocusManagerApi,
} from '../bim-3d/accessibility/KeyboardFocusManager';

let instance: KeyboardFocusManagerApi | null = null;

/** Lazily-instantiated 2D focus manager. Stable across remounts. */
export function getKeyboardFocus2DManager(): KeyboardFocusManagerApi {
  if (!instance) instance = createKeyboardFocusManager();
  return instance;
}

/** Test-only — reset the singleton so each test starts from a clean slate. */
export function __resetKeyboardFocus2DManagerForTests(): void {
  instance?.dispose();
  instance = null;
}
