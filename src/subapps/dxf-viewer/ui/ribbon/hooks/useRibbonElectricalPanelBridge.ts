'use client';

/**
 * ADR-408 Φ3/Φ6 — Bridge μεταξύ του contextual electrical-panel ribbon tab και του
 * active `ElectricalPanelEntity` params.
 *
 * Mirror του `useRibbonMepManifoldBridge` (selected-entity branch + folded
 * management panel). Κάθε combobox change δρομολογείται μέσω του ΥΠΑΡΧΟΝΤΟΣ
 * `UpdateElectricalPanelParamsCommand` (`useCommandHistory().execute`) — το ίδιο
 * command πίσω από τα on-canvas grips (N.0.2, μηδέν drift) — ώστε η αλλαγή να είναι
 * undoable + geometry/validation να επανυπολογίζονται atomically.
 * `useElectricalPanelPersistence` picks up την αλλαγή μέσω debounced auto-save στο
 * params-change του selected panel· επιπλέον emit-άρουμε `bim:electrical-panel-
 * params-updated` για parity με τα grips (3D sync).
 *
 * Η διαχείριση κυκλωμάτων ΔΕΝ ζει εδώ: το folded «Κυκλώματα» panel επαναχρησιμοποιεί
 * αυτούσια τα circuit widgets (`useRibbonMepCircuitBridge`), που ήδη συγχρονίζονται
 * με τον επιλεγμένο πίνακα μέσω `useMepCircuitEditorSync`. Ο bridge εδώ απλώς
 * αποκαλύπτει το panel όταν ο πίνακας τροφοδοτεί ≥1 κύκλωμα (Revit "Edit Circuits").
 *
 * No-ops για commandKeys εκτός `ELECTRICAL_PANEL_RIBBON_KEYS` ώστε να composeί με τα
 * υπόλοιπα bridges στο `useRibbonCommands`.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-408-mep-connectors-and-systems.md
 */

import { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { isElectricalPanelEntity } from '../../../types/entities';
import type {
  ElectricalPanelEntity,
  ElectricalPanelParams,
} from '../../../bim/types/electrical-panel-types';
import { useCommandHistory } from '../../../core/commands';
import { UpdateElectricalPanelParamsCommand } from '../../../core/commands/entity-commands/UpdateElectricalPanelParamsCommand';
import { LevelSceneManagerAdapter } from '../../../systems/entity-creation/LevelSceneManagerAdapter';
import {
  ELECTRICAL_PANEL_RIBBON_KEYS,
  ELECTRICAL_PANEL_RIBBON_KEYS_ACTIONS,
  ELECTRICAL_PANEL_RIBBON_VISIBILITY_KEYS,
  isElectricalPanelRibbonKey,
  isElectricalPanelVisibilityKey,
} from './bridge/electrical-panel-command-keys';
import { EventBus } from '../../../systems/events/EventBus';
import { useMepSystemStore } from '../../../bim/mep-systems/mep-system-store';
import { resolveManagedSystems } from '../../../bim/mep-systems/mep-circuit-editor';
import type { RibbonComboboxState, RibbonToggleState } from '../context/RibbonCommandContext';
import type { useLevels } from '../../../systems/levels';
import type { useUniversalSelection } from '../../../systems/selection';

type LevelManagerLike = Pick<
  ReturnType<typeof useLevels>,
  'getLevelScene' | 'setLevelScene' | 'currentLevelId'
>;

type UniversalSelectionLike = Pick<
  ReturnType<typeof useUniversalSelection>,
  'getPrimaryId'
>;

export interface UseRibbonElectricalPanelBridgeProps {
  readonly levelManager: LevelManagerLike;
  readonly universalSelection: UniversalSelectionLike;
}

export interface RibbonElectricalPanelBridge {
  readonly onComboboxChange: (commandKey: string, value: string) => void;
  readonly getComboboxState: (commandKey: string) => RibbonComboboxState | null;
  readonly onToggle: (commandKey: string, nextValue: boolean) => void;
  readonly getToggleState: (commandKey: string) => RibbonToggleState;
  readonly onAction: (action: string) => void;
  readonly getPanelVisibility: (visibilityKey: string) => boolean;
}

/** commandKey → numeric `ElectricalPanelParams` field. */
const NUMBER_KEY_TO_FIELD: Readonly<Record<string, keyof ElectricalPanelParams>> = {
  [ELECTRICAL_PANEL_RIBBON_KEYS.params.width]: 'width',
  [ELECTRICAL_PANEL_RIBBON_KEYS.params.length]: 'length',
  [ELECTRICAL_PANEL_RIBBON_KEYS.params.rotation]: 'rotation',
  [ELECTRICAL_PANEL_RIBBON_KEYS.params.bodyHeight]: 'bodyHeightMm',
  [ELECTRICAL_PANEL_RIBBON_KEYS.params.mountingElevation]: 'mountingElevationMm',
};

const NULL_TOGGLE: RibbonToggleState = false;

export function useRibbonElectricalPanelBridge(
  props: UseRibbonElectricalPanelBridgeProps,
): RibbonElectricalPanelBridge {
  const { levelManager, universalSelection } = props;
  const { execute: executeCommand } = useCommandHistory();
  const { t } = useTranslation('dxf-viewer-shell');

  const resolvePanel = useCallback((): ElectricalPanelEntity | null => {
    const id = universalSelection.getPrimaryId();
    if (!id || !levelManager.currentLevelId) return null;
    const scene = levelManager.getLevelScene(levelManager.currentLevelId);
    if (!scene) return null;
    const e = scene.entities.find((x) => x.id === id);
    if (!e || !isElectricalPanelEntity(e)) return null;
    return e;
  }, [levelManager, universalSelection]);

  /**
   * Dispatch the params patch through `UpdateElectricalPanelParamsCommand` so the
   * change is undoable + geometry/validation recompute atomically. `isDragging=false`
   * → each ribbon edit is its own undo entry (drag merging lives in the grip path).
   */
  const dispatchParams = useCallback(
    (panel: ElectricalPanelEntity, nextParams: ElectricalPanelParams): void => {
      if (!levelManager.currentLevelId) return;
      const sm = new LevelSceneManagerAdapter(
        levelManager.getLevelScene,
        levelManager.setLevelScene,
        levelManager.currentLevelId,
      );
      executeCommand(
        new UpdateElectricalPanelParamsCommand(panel.id, nextParams, panel.params, sm, false),
      );
      EventBus.emit('bim:electrical-panel-params-updated', { panelId: panel.id });
    },
    [executeCommand, levelManager],
  );

  const getComboboxState = useCallback(
    (commandKey: string): RibbonComboboxState | null => {
      const panel = resolvePanel();
      if (!panel) return null;
      if (isElectricalPanelRibbonKey(commandKey)) {
        const field = NUMBER_KEY_TO_FIELD[commandKey];
        const raw = panel.params[field];
        if (typeof raw !== 'number') return null;
        return { value: String(Math.round(raw)), options: [] };
      }
      return null;
    },
    [resolvePanel],
  );

  const onComboboxChange = useCallback(
    (commandKey: string, value: string): void => {
      const panel = resolvePanel();
      if (!panel) return;
      if (!isElectricalPanelRibbonKey(commandKey)) return;
      const numeric = Number.parseFloat(value);
      if (Number.isNaN(numeric)) return;
      const field = NUMBER_KEY_TO_FIELD[commandKey];
      const nextParams = { ...panel.params, [field]: numeric } as ElectricalPanelParams;
      dispatchParams(panel, nextParams);
    },
    [resolvePanel, dispatchParams],
  );

  // Toggles unused — interface parity με τα υπόλοιπα bridges.
  const onToggle = useCallback((_key: string, _next: boolean): void => {
    /* no-op */
  }, []);
  const getToggleState = useCallback((_key: string): RibbonToggleState => NULL_TOGGLE, []);

  const onAction = useCallback(
    (action: string): void => {
      // ADR-363 — «Κλείσιμο» handled centrally in routeRibbonAction (single SSoT).
      if (action !== ELECTRICAL_PANEL_RIBBON_KEYS_ACTIONS.delete) return;
      const panel = resolvePanel();
      if (!panel) return;
      const confirmed = window.confirm(t('ribbon.commands.electricalPanelEditor.deleteConfirm'));
      if (!confirmed) return;
      EventBus.emit('bim:electrical-panel-delete-requested', { panelId: panel.id });
    },
    [resolvePanel, universalSelection, t],
  );

  const getPanelVisibility = useCallback(
    (visibilityKey: string): boolean => {
      if (!isElectricalPanelVisibilityKey(visibilityKey)) return true;
      const panel = resolvePanel();
      if (!panel) return false;
      if (visibilityKey === ELECTRICAL_PANEL_RIBBON_VISIBILITY_KEYS.hasCircuits) {
        // Revit "Edit Circuits" — the «Κυκλώματα» panel surfaces iff the panel
        // sources ≥1 circuit (mirrors the manifold's folded «Δίκτυο» panel).
        const systems = useMepSystemStore.getState().getSystems();
        return resolveManagedSystems([panel], systems).length > 0;
      }
      return false;
    },
    [resolvePanel],
  );

  return useMemo(
    () => ({ onComboboxChange, getComboboxState, onToggle, getToggleState, onAction, getPanelVisibility }),
    [onComboboxChange, getComboboxState, onToggle, getToggleState, onAction, getPanelVisibility],
  );
}

/** Type guard used by `useRibbonCommands` composer (panel visibility). */
export function isElectricalPanelPanelVisibilityKey(visibilityKey: string): boolean {
  return isElectricalPanelVisibilityKey(visibilityKey);
}
