// ============================================================================
// ⌨️ use2DKeyboardFocus — React hook (ADR-366 Phase 4.6 / A.7.Q1)
// ============================================================================
//
// Mirror of `bim-3d/shortcuts/use3DShortcuts.ts` for the 2D DXF viewer.
// Registers a window-level keydown listener (capture phase) that handles:
//   - Tab          → cycle keyboard focus forward (visible 2D entities)
//   - Shift+Tab    → cycle keyboard focus backward
//   - Enter        → toggle universal selection on the focused entity
//   - Escape       → clear keyboard focus (registered via escape-bus, low priority)
//
// Mode-gated: all handlers no-op when `mode !== '2d'` (ViewMode3DStore). The 3D
// handler in `use3DShortcuts` is mode-gated to `'3d-*'` modes, so the two
// listeners never both consume the same event.
//
// ADR-040 compliance: zero `useSyncExternalStore` — reads happen at keydown
// time via getter pattern. Hook is stable; dependencies are React-stable refs.
// ============================================================================

import { useEffect } from 'react';
import { useViewMode3DStore } from '../../bim-3d/stores/ViewMode3DStore';
import { useEscapeHandler, ESC_PRIORITY } from '../../systems/escape-bus';
import { getKeyboardFocus2DManager } from '../../accessibility/keyboard-focus-2d-manager';
import { computeFocusOrder2D } from '../../accessibility/focus-2d-order';
import type { DxfScene } from '../../canvas-v2/dxf-canvas/dxf-types';
import type { ViewTransform, Viewport } from '../../rendering/types/Types';
import type { SelectableEntityType } from '../../systems/selection/types';

export interface Use2DKeyboardFocusConfig {
  /** Lazy getter for current scene — reads at keydown time (getter pattern). */
  readonly getScene: () => DxfScene | null;
  /** Lazy getter for current transform — pan/zoom may shift between keypresses. */
  readonly getTransform: () => ViewTransform;
  /** Lazy getter for current viewport — resize between keypresses must reflect. */
  readonly getViewport: () => Viewport;
  /**
   * Universal selection toggle — invoked on Enter. The hook abstains from the
   * type lookup; callers map all DXF/BIM entities to `'dxf-entity'` per ADR-030.
   */
  readonly toggleEntity: (id: string, type: SelectableEntityType) => void;
  /** Optional outer gate (e.g., feature flag). Defaults to true. */
  readonly enabled?: boolean;
}

function isInputFocused(): boolean {
  const focused = document.activeElement;
  if (!focused) return false;
  if (focused.tagName === 'INPUT') return true;
  if (focused.tagName === 'TEXTAREA') return true;
  return focused.getAttribute('contenteditable') === 'true';
}

export function use2DKeyboardFocus({
  getScene,
  getTransform,
  getViewport,
  toggleEntity,
  enabled = true,
}: Use2DKeyboardFocusConfig): void {
  // Tab + Shift+Tab + Enter handler — capture-phase window listener.
  useEffect(() => {
    if (!enabled) return undefined;
    const focusManager = getKeyboardFocus2DManager();

    const onKeyDown = (event: KeyboardEvent) => {
      if (isInputFocused()) return;
      const is2D = useViewMode3DStore.getState().mode === '2d';
      if (!is2D) return;

      // Tab / Shift+Tab — cycle focus through visible entities.
      if (event.key === 'Tab' && !event.ctrlKey && !event.metaKey && !event.altKey) {
        event.preventDefault();
        const scene = getScene();
        const transform = getTransform();
        const viewport = getViewport();
        focusManager.setOrder(computeFocusOrder2D(scene, transform, viewport));
        if (event.shiftKey) focusManager.prev();
        else focusManager.next();
        return;
      }

      // Enter (no modifier) — toggle universal selection on focused entity.
      if (
        event.key === 'Enter' &&
        !event.shiftKey && !event.ctrlKey && !event.metaKey && !event.altKey
      ) {
        const focusedId = focusManager.getFocused();
        if (!focusedId) return;
        event.preventDefault();
        toggleEntity(focusedId, 'dxf-entity');
      }
    };

    window.addEventListener('keydown', onKeyDown, { capture: true });
    return () => window.removeEventListener('keydown', onKeyDown, { capture: true });
  }, [enabled, getScene, getTransform, getViewport, toggleEntity]);

  // Escape — clear focus via the central ESC bus. Priority sits BELOW
  // DRAW_TOOL (500) and COLOR_MENU (450) so active drawing cancel wins, and
  // focus clears only when nothing else owns Escape.
  useEscapeHandler({
    id: 'use-2d-keyboard-focus/clear-focus',
    priority: ESC_PRIORITY.FOCUS_CLEAR,
    canHandle: () => {
      if (!enabled) return false;
      if (useViewMode3DStore.getState().mode !== '2d') return false;
      return getKeyboardFocus2DManager().getFocused() !== null;
    },
    handle: () => {
      getKeyboardFocus2DManager().clear();
      return true;
    },
  });
}
