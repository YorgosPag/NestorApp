// ============================================================================
// ⌨️ use3DShortcuts — React hook wiring BIM 3D shortcuts (ADR-366 Phase 4.4)
// ============================================================================
//
// Window-level keydown listener bridging `dispatchShortcut()` to React-owned
// services (ThreeJsSceneManager, ViewMode3DStore, sonner toast). Mounted by
// BimViewport3D — single subscription, lifecycle bound to component mount.
//
// ADR-040 compliance: zero `useSyncExternalStore` calls — store reads happen
// at keydown time, not during React render, so this hook never causes
// re-renders nor blocks the orchestrator's micro-leaf pattern.
// ============================================================================

import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { useViewMode3DStore } from '../stores/ViewMode3DStore';
import { useSelection3DStore } from '../stores/Selection3DStore';
import { useBim3DEditStore } from '../stores/Bim3DEditStore';
import type { ThreeJsSceneManager } from '../scene/ThreeJsSceneManager';
import {
  dispatchShortcut,
  panStepToScreenDelta,
  type ShortcutDispatchContext,
} from './shortcut-dispatcher';

interface Use3DShortcutsConfig {
  /** Live manager ref — null while 3D viewport is unmounted. */
  readonly getManager: () => ThreeJsSceneManager | null;
  /** Gate by component mount — hook still creates listener, but no-ops when false. */
  readonly active: boolean;
  /** ADR-366 §C.6.Q4 — crop region toggle callback. */
  readonly onCropRegionToggle?: () => void;
}

/**
 * Registers a window-level keydown listener that drives 3D viewport shortcuts.
 *
 * The hook is intentionally stable — it depends only on the boolean `active`
 * flag, so it does not re-subscribe on every render. The callback reads
 * `getManager()` lazily so the latest manager instance is used after remounts.
 */
export function use3DShortcuts({ getManager, active, onCropRegionToggle }: Use3DShortcutsConfig): void {
  const { t } = useTranslation('bim3d');

  useEffect(() => {
    if (!active) return undefined;

    const onKeyDown = (event: KeyboardEvent) => {
      // Skip while typing in inputs / textareas / contenteditable elements.
      const focused = document.activeElement;
      if (
        focused &&
        (focused.tagName === 'INPUT' ||
          focused.tagName === 'TEXTAREA' ||
          focused.getAttribute('contenteditable') === 'true')
      ) {
        return;
      }

      const manager = getManager();
      if (!manager) return;

      const ctx: ShortcutDispatchContext = {
        is3D: useViewMode3DStore.getState().mode !== '2d',
        onSnapToView: (view) => manager.snapToCanonicalView(view),
        onSnapHome: () => manager.snapToHomeView(),
        onFitFrame3D: () => manager.frameSelectionOrFitExtents(),
        onSwitchTo2D: () => useViewMode3DStore.getState().toggle2D3D(),
        onAutoSwitchToast: (label) =>
          toast.info(t('shortcuts.modeSwitch.toast', { shortcut: label })),
        onPan3D: (direction, step) => {
          const { dx, dy } = panStepToScreenDelta(direction, step);
          manager.panViewportByPixels(dx, dy);
        },
        onFocusNext3D: () => manager.cycleKeyboardFocus('next'),
        onFocusPrev3D: () => manager.cycleKeyboardFocus('prev'),
        onFocusSelect3D: () => manager.selectFocusedEntity(),
        onFocusClear3D: () => manager.clearKeyboardFocus(),
        onCropRegionToggle,
        // ADR-402 §Sub-Phase 2 — BIM move gizmo keys (read stores at keydown time).
        editActive: useBim3DEditStore.getState().editToolActive,
        onMoveGizmoToggle3D: () => {
          const edit = useBim3DEditStore.getState();
          if (edit.editToolActive) { edit.deactivate(); return; }
          const sel = useSelection3DStore.getState();
          if (sel.selectedBimId) edit.activateMove(sel.selectedBimId, sel.selectedBimType);
        },
        onEditEscape3D: () => useBim3DEditStore.getState().deactivate(),
        onEditAxisLock3D: (axis) => useBim3DEditStore.getState().toggleAxisLock(axis),
      };

      const result = dispatchShortcut(event, ctx);
      if (result.handled) {
        event.preventDefault();
        event.stopPropagation();
      }
    };

    // Capture phase: claim 3D shortcuts before 2D `useKeyboardShortcuts`
    // (also registered in capture) can react — avoids both handlers firing
    // for shared keys like F.
    window.addEventListener('keydown', onKeyDown, { capture: true });
    return () => window.removeEventListener('keydown', onKeyDown, { capture: true });
  }, [active, getManager, t]);
}
