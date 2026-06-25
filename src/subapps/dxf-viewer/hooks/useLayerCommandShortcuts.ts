/**
 * useLayerCommandShortcuts — ADR-358 §5.6.bis (Phase 10).
 *
 * Dispatches the 5 keyboard-bound layer commands:
 *   - Ctrl+Shift+I  → LayerIsolateCommand (targets entity-selection's layers)
 *   - Ctrl+Alt+I    → LayerIsolateInverseCommand (inverse mode single-shot)
 *   - Ctrl+Shift+U  → LayerUnisolateCommand (restore snapshot)
 *   - Ctrl+Shift+T  → LayerThawAllCommand
 *   - Ctrl+Shift+O  → LayerOnAllCommand
 *
 * Off / Freeze / Lock are click-driven via the canvas context menu (single
 * layer at a time) — not wired here.
 *
 * The command history is supplied by the caller (top-level DxfViewerContent).
 */

'use client';

import { useEffect } from 'react';

import { matchesShortcut } from '../config/keyboard-shortcuts';
import { resolveLayerIsolateSettings, type LayerIsolateSettings } from '../services/layer-isolate-resolver';
import {
  LayerIsolateCommand,
  LayerIsolateInverseCommand,
  LayerUnisolateCommand,
  LayerThawAllCommand,
  LayerOnAllCommand,
} from '../core/commands/layer';
import type { ICommand, ICommandHistory } from '../core/commands/interfaces';
import type { SceneModel } from '../types/entities';
import { getAllLayers } from '../stores/LayerStore';
// ADR-532 Stage B5 — read the live entity selection at keydown time from the SSoT
// store (ADR-040 dual-access) instead of receiving it as a reactive prop, so the
// listener registers once (not per selection change).
import { SelectedEntitiesStore } from '../systems/selection';

interface UseLayerCommandShortcutsParams {
  currentScene: SceneModel | null;
  commandHistory: ICommandHistory | null;
  /** Resolved Layer Isolate project setting (Firestore `dxfSettings.layerIsolate`). */
  projectIsolateSetting?: Partial<LayerIsolateSettings> | null;
  /** Optional user preference (localStorage). */
  userIsolateSetting?: Partial<LayerIsolateSettings> | null;
}

function isInputFocused(): boolean {
  const el = document.activeElement;
  if (!el) return false;
  return (
    el.tagName === 'INPUT' ||
    el.tagName === 'TEXTAREA' ||
    el.getAttribute('contenteditable') === 'true'
  );
}

/** Resolve which layers to isolate: prefer entity-selection layers; fallback to current layer. */
function resolveTargetLayerIds(
  selectedEntityIds: ReadonlyArray<string>,
  scene: SceneModel | null
): ReadonlyArray<string> {
  if (!scene || selectedEntityIds.length === 0) return [];
  const ids = new Set<string>();
  for (const eid of selectedEntityIds) {
    const entity = scene.entities.find((e) => e.id === eid);
    if (entity && (entity as { layerId?: string }).layerId) {
      ids.add((entity as { layerId: string }).layerId);
    }
  }
  return Array.from(ids);
}

export function useLayerCommandShortcuts({
  currentScene,
  commandHistory,
  projectIsolateSetting,
  userIsolateSetting,
}: UseLayerCommandShortcutsParams): void {
  useEffect(() => {
    if (!commandHistory) return;

    const dispatch = (cmd: ICommand): void => {
      commandHistory.execute(cmd);
    };

    const onKeyDown = (e: KeyboardEvent): void => {
      if (isInputFocused()) return;
      // ADR-532 Stage B5 — live selection at event time (no subscription).
      const selectedEntityIds = SelectedEntitiesStore.getSelectedEntityIds();

      if (matchesShortcut(e, 'layerIsolate')) {
        e.preventDefault();
        const targetLayerIds = resolveTargetLayerIds(selectedEntityIds, currentScene);
        if (targetLayerIds.length === 0 && getAllLayers().length === 0) return;
        const settings = resolveLayerIsolateSettings({
          projectSetting: projectIsolateSetting,
          userPreference: userIsolateSetting,
        });
        dispatch(new LayerIsolateCommand({ targetLayerIds, settings, category: null }));
        return;
      }

      if (matchesShortcut(e, 'layerIsolateInverse')) {
        e.preventDefault();
        const targetLayerIds = resolveTargetLayerIds(selectedEntityIds, currentScene);
        if (targetLayerIds.length === 0 && getAllLayers().length === 0) return;
        const settings = resolveLayerIsolateSettings({
          projectSetting: projectIsolateSetting,
          userPreference: userIsolateSetting,
        });
        dispatch(new LayerIsolateInverseCommand({ targetLayerIds, settings, category: null }));
        return;
      }

      if (matchesShortcut(e, 'layerUnisolate')) {
        e.preventDefault();
        dispatch(new LayerUnisolateCommand());
        return;
      }

      if (matchesShortcut(e, 'layerThawAll')) {
        e.preventDefault();
        dispatch(new LayerThawAllCommand());
        return;
      }

      if (matchesShortcut(e, 'layerOnAll')) {
        e.preventDefault();
        dispatch(new LayerOnAllCommand());
        return;
      }
    };

    window.addEventListener('keydown', onKeyDown, { capture: true });
    return () => window.removeEventListener('keydown', onKeyDown, { capture: true });
    // ADR-532 Stage B5 — `selectedEntityIds` removed from deps (read live at event
    // time), so the listener is registered once, not re-bound on every selection.
  }, [commandHistory, currentScene, projectIsolateSetting, userIsolateSetting]);
}
