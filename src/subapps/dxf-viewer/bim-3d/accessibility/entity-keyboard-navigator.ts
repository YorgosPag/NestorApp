// ============================================================================
// ENTITY KEYBOARD NAVIGATOR — Arrow/Home/End/PageUp/PageDown (ADR-366 Phase 9 / C.5.Q3)
// ============================================================================
//
// Handles keyboard navigation for the entity proxy container:
//   ArrowRight / ArrowDown → next entity
//   ArrowLeft  / ArrowUp   → previous entity
//   Home                   → first entity in order
//   End                    → last entity in order
//   PageDown               → skip forward ~10 entities (floor-group approximation)
//   PageUp                 → skip back   ~10 entities
//   Enter / Space          → activate (select) focused entity
//   Escape                 → clear focus, return to canvas root
//
// Reads KeyboardFocusManager for current state. Does not subscribe to stores
// directly — caller provides getOrder() which reflects the current frustum-
// culled, floor-filtered order from focus-order.ts SSoT.
// ============================================================================

import type { KeyboardFocusManagerApi } from './KeyboardFocusManager';

const FLOOR_SKIP_COUNT = 10;

const HANDLED_KEYS = new Set([
  'ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowUp',
  'Home', 'End', 'PageDown', 'PageUp',
  'Enter', ' ', 'Escape',
]);

export interface EntityKeyboardNavigatorOptions {
  readonly focusManager: KeyboardFocusManagerApi;
  /** Returns current ordered entity bimIds (frustum-culled, floor-filtered). */
  readonly getOrder: () => readonly string[];
  /** Called when Enter/Space activates the focused entity (e.g. open BimEntityCardPanel). */
  readonly onActivate?: (bimId: string) => void;
}

export interface EntityKeyboardNavigator {
  handleKeyDown(e: KeyboardEvent): void;
  dispose(): void;
}

export function createEntityKeyboardNavigator({
  focusManager,
  getOrder,
  onActivate,
}: EntityKeyboardNavigatorOptions): EntityKeyboardNavigator {
  let disposed = false;

  function handleKeyDown(e: KeyboardEvent): void {
    if (disposed) return;
    if (!HANDLED_KEYS.has(e.key)) return;

    const order = getOrder();
    const currentId = focusManager.getFocused();

    switch (e.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        e.preventDefault();
        focusManager.next();
        break;

      case 'ArrowLeft':
      case 'ArrowUp':
        e.preventDefault();
        focusManager.prev();
        break;

      case 'Home':
        e.preventDefault();
        focusManager.setFocus(order[0] ?? null);
        break;

      case 'End':
        e.preventDefault();
        focusManager.setFocus(order[order.length - 1] ?? null);
        break;

      case 'PageDown': {
        e.preventDefault();
        if (order.length === 0) break;
        if (!currentId) {
          focusManager.setFocus(order[0] ?? null);
          break;
        }
        const idx = order.indexOf(currentId);
        focusManager.setFocus(order[Math.min(idx + FLOOR_SKIP_COUNT, order.length - 1)] ?? null);
        break;
      }

      case 'PageUp': {
        e.preventDefault();
        if (order.length === 0) break;
        if (!currentId) {
          focusManager.setFocus(order[order.length - 1] ?? null);
          break;
        }
        const idx = order.indexOf(currentId);
        focusManager.setFocus(order[Math.max(idx - FLOOR_SKIP_COUNT, 0)] ?? null);
        break;
      }

      case 'Enter':
      case ' ':
        e.preventDefault();
        if (currentId) onActivate?.(currentId);
        break;

      case 'Escape':
        e.preventDefault();
        focusManager.clear();
        break;
    }
  }

  return {
    handleKeyDown,
    dispose: () => { disposed = true; },
  };
}
