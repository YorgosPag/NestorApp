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
import { addGlobalShortcutListener } from '../keyboard/global-shortcut-listener';
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

    // N.18 (2026-07-26) — οι δύο isolate διαδρομές ήταν αντίγραφο η μία της άλλης
    // (9 γραμμές / 57 tokens, εντοπισμένο από `jscpd:diff`): ίδια επίλυση στόχων, ίδιος
    // φύλακας κενού, ίδια επίλυση ρυθμίσεων — διέφεραν **μόνο** στην κλάση εντολής. Η
    // κοινή λογική ζει τώρα μία φορά· η διαφορά είναι ένα boolean. Ζει **έξω** από τον
    // `onKeyDown` ώστε ο handler να μείνει κάτω από το όριο των 40 γραμμών (N.7.1).
    const isolate = (inverse: boolean, selectedEntityIds: ReadonlyArray<string>): void => {
      const targetLayerIds = resolveTargetLayerIds(selectedEntityIds, currentScene);
      if (targetLayerIds.length === 0 && getAllLayers().length === 0) return;
      const args = {
        targetLayerIds,
        settings: resolveLayerIsolateSettings({
          projectSetting: projectIsolateSetting,
          userPreference: userIsolateSetting,
        }),
        category: null,
      };
      dispatch(inverse ? new LayerIsolateInverseCommand(args) : new LayerIsolateCommand(args));
    };

    const onKeyDown = (e: KeyboardEvent): void => {
      // ADR-532 Stage B5 — live selection at event time (no subscription).
      const selectedEntityIds = SelectedEntitiesStore.getSelectedEntityIds();

      if (matchesShortcut(e, 'layerIsolate')) {
        e.preventDefault();
        isolate(false, selectedEntityIds);
        return;
      }

      if (matchesShortcut(e, 'layerIsolateInverse')) {
        e.preventDefault();
        isolate(true, selectedEntityIds);
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

    // ADR-711 Boy-Scout — ο wrapper ρωτά «γράφει ο χρήστης;» ΚΑΙ «κατέχει modal το
    // πληκτρολόγιο;». Ο τοπικός `isInputFocused` που έφυγε από πάνω ρωτούσε μόνο το
    // πρώτο, και το ρωτούσε ελλιπώς (έχανε `contenteditable=""` και το κληρονομημένο).
    return addGlobalShortcutListener(onKeyDown);
    // ADR-532 Stage B5 — `selectedEntityIds` removed from deps (read live at event
    // time), so the listener is registered once, not re-bound on every selection.
  }, [commandHistory, currentScene, projectIsolateSetting, userIsolateSetting]);
}
