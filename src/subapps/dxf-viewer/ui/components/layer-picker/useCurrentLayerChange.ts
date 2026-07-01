/**
 * useCurrentLayerChange — ADR-358 §5.5.bis Q8 + ADR-510 Φ4 (Google/Revit-grade SSoT).
 *
 * THE single, effect-free action for a *user-initiated* current-layer change,
 * shared by EVERY UI surface that lets the user pick the active drawing layer
 * (the `CurrentLayerPicker` popover AND the ribbon line-tool «Επίπεδο» combobox).
 * Big-player parity (Revit «active workset» / Cinema 4D layer manager / Figma
 * page switch): changing the active layer from any surface routes through ONE
 * controller and yields the SAME feedback — permission gate + toast + recent
 * FIFO — instead of a fragmented per-surface flow.
 *
 * Owns ONLY the imperative mutation + validation + toast. It holds NO effects:
 *   - the recent FIFO is written by `LayerStore.setCurrentLayerId`
 *     (`pushRecentInternal`) / `pushRecentLayer` here;
 *   - per-project / per-level persistence + hydration are owned by the
 *     always-mounted `useCurrentLayerPickerState` instance (status-bar variant),
 *     which reacts to the `LayerStore.currentLayerId` change this action makes.
 * Keeping this hook effect-free is what lets a second consumer (the ribbon
 * bridge) call it WITHOUT double-mounting the picker's persistence/hydration
 * effects (which would otherwise race and reset the current layer).
 */

import { useCallback, useMemo, useSyncExternalStore } from 'react';
import {
  getLayerStoreSnapshot,
  pushRecentLayer,
  setCurrentLayerId,
  subscribeLayerStore,
} from '../../../stores/LayerStore';
import { useNotifications } from '../../../../../providers/NotificationProvider';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useCanEditText } from '../../../hooks/useCanEditText';
import type { SceneLayer } from '../../../types/entities';

/**
 * Outcome of a change attempt, so UI callers (popover) can branch on it:
 *   - `changed`    → current layer moved to the target (+ success toast).
 *   - `reselected` → target was already current; recent FIFO bumped, no toast.
 *   - `blocked`    → frozen / locked-without-permission (warning toast shown).
 *   - `not-found`  → id not in the live layer set (no-op, no toast).
 */
export type CurrentLayerChangeResult =
  | 'changed'
  | 'reselected'
  | 'blocked'
  | 'not-found';

export interface UseCurrentLayerChange {
  /** Attempt to make `layerId` the active drawing layer. Returns the outcome. */
  changeCurrentLayer: (layerId: string) => CurrentLayerChangeResult;
}

export function useCurrentLayerChange(): UseCurrentLayerChange {
  const snapshot = useSyncExternalStore(
    subscribeLayerStore,
    getLayerStoreSnapshot,
    getLayerStoreSnapshot,
  );
  const { success: notifySuccess, warning: notifyWarning } = useNotifications();
  const { t } = useTranslation('dxf-viewer-shell');
  const { canUnlockLayer } = useCanEditText();

  const layerById = useMemo(() => {
    const map = new Map<string, SceneLayer>();
    for (const layer of snapshot.layers) map.set(layer.id ?? layer.name, layer);
    return map;
  }, [snapshot.layers]);

  const changeCurrentLayer = useCallback(
    (layerId: string): CurrentLayerChangeResult => {
      const target = layerById.get(layerId);
      if (!target) return 'not-found';
      // Frozen layers are never drawable (AutoCAD parity) — block outright.
      if (target.frozen === true) {
        notifyWarning(t('layerPicker.toastFrozen', { name: target.name }));
        return 'blocked';
      }
      // Locked layers need unlock permission before they can become active.
      if (target.locked && !canUnlockLayer) {
        notifyWarning(t('layerPicker.toastLocked', { name: target.name }));
        return 'blocked';
      }
      // Already current → `setCurrentLayerId` would no-op, so bump the recent
      // FIFO explicitly (keeps re-picks fresh) without a redundant toast.
      if (snapshot.currentLayerId === layerId) {
        pushRecentLayer(layerId);
        return 'reselected';
      }
      setCurrentLayerId(layerId);
      notifySuccess(t('layerPicker.toastChanged', { name: target.name }));
      return 'changed';
    },
    [layerById, snapshot.currentLayerId, canUnlockLayer, notifySuccess, notifyWarning, t],
  );

  return { changeCurrentLayer };
}
