'use client';

/**
 * ADR-406 — Bridge μεταξύ contextual MEP fixture ribbon tab και active
 * `MepFixtureEntity` params.
 *
 * Mirrors `useRibbonColumnBridge` (selected-entity branch only — το φωτιστικό
 * δεν έχει drawing-tool property panel· placement γίνεται με free-point click).
 * Κάθε combobox change δρομολογείται μέσω `UpdateMepFixtureParamsCommand`
 * (`useCommandHistory().execute`) ώστε η αλλαγή να είναι undoable +
 * geometry/validation να επανυπολογίζονται atomically.
 * `useMepFixturePersistence` picks up την αλλαγή μέσω debounced auto-save.
 * Ribbon edits χρησιμοποιούν `isDragging=false` ώστε κάθε edit να είναι δικό
 * του undo entry (drag merging ζει στο grip-commit path).
 *
 * No-ops για commandKeys εκτός `MEP_FIXTURE_RIBBON_KEYS` ώστε να composeί με τα
 * υπόλοιπα bridges στο `useRibbonCommands`.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-406-point-based-mep-fixture.md
 */

import { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { isMepFixtureEntity } from '../../../types/entities';
import type {
  MepFixtureEntity,
  MepFixtureParams,
  MepFixtureShape,
} from '../../../bim/types/mep-fixture-types';
import { useCommandHistory } from '../../../core/commands';
import { UpdateMepFixtureParamsCommand } from '../../../core/commands/entity-commands/UpdateMepFixtureParamsCommand';
import { LevelSceneManagerAdapter } from '../../../systems/entity-creation/LevelSceneManagerAdapter';
import {
  MEP_FIXTURE_RIBBON_KEYS,
  MEP_FIXTURE_RIBBON_KEYS_ACTIONS,
  MEP_FIXTURE_RIBBON_VISIBILITY_KEYS,
  isMepFixtureRibbonKey,
  isMepFixtureRibbonStringKey,
  isMepFixtureVisibilityKey,
} from './bridge/mep-fixture-command-keys';
import { EventBus } from '../../../systems/events/EventBus';
import { useMepSystemStore } from '../../../bim/mep-systems/mep-system-store';
import { useMepCircuitEditorStore } from '../../../bim/mep-systems/mep-circuit-editor-store';
import { resolveManagedCircuits } from '../../../bim/mep-systems/mep-circuit-editor';
import type {
  RibbonComboboxState,
  RibbonToggleState,
} from '../context/RibbonCommandContext';
import type { useLevels } from '../../../systems/levels';
import type { useUniversalSelection } from '../../../systems/selection';

type LevelManagerLike = Pick<
  ReturnType<typeof useLevels>,
  'getLevelScene' | 'setLevelScene' | 'currentLevelId'
>;

type UniversalSelectionLike = Pick<
  ReturnType<typeof useUniversalSelection>,
  'getPrimaryId' | 'getSelectedEntityIds' | 'select'
>;

export interface UseRibbonMepFixtureBridgeProps {
  readonly levelManager: LevelManagerLike;
  readonly universalSelection: UniversalSelectionLike;
}

export interface RibbonMepFixtureBridge {
  readonly onComboboxChange: (commandKey: string, value: string) => void;
  readonly getComboboxState: (commandKey: string) => RibbonComboboxState | null;
  readonly onToggle: (commandKey: string, nextValue: boolean) => void;
  readonly getToggleState: (commandKey: string) => RibbonToggleState;
  /** Handles ribbon simple-button actions (close / delete). */
  readonly onAction: (action: string) => void;
  /**
   * Panel visibility resolver. Returns `true` όταν το panel πρέπει να
   * εμφανίζεται. `rectangularParams` → shape === 'rectangular'. Keys εκτός
   * `MEP_FIXTURE_RIBBON_VISIBILITY_KEYS` επιστρέφουν `true` (no-op).
   */
  readonly getPanelVisibility: (visibilityKey: string) => boolean;
}

/** commandKey → numeric `MepFixtureParams` field. */
const NUMBER_KEY_TO_FIELD: Readonly<Record<string, keyof MepFixtureParams>> = {
  [MEP_FIXTURE_RIBBON_KEYS.params.width]: 'width',
  [MEP_FIXTURE_RIBBON_KEYS.params.length]: 'length',
  [MEP_FIXTURE_RIBBON_KEYS.params.rotation]: 'rotation',
  [MEP_FIXTURE_RIBBON_KEYS.params.bodyHeight]: 'bodyHeightMm',
  [MEP_FIXTURE_RIBBON_KEYS.params.mountingElevation]: 'mountingElevationMm',
};

const NULL_TOGGLE: RibbonToggleState = false;

export function useRibbonMepFixtureBridge(
  props: UseRibbonMepFixtureBridgeProps,
): RibbonMepFixtureBridge {
  const { levelManager, universalSelection } = props;
  const { execute: executeCommand } = useCommandHistory();
  const { t } = useTranslation('dxf-viewer-shell');

  const resolveFixture = useCallback((): MepFixtureEntity | null => {
    const id = universalSelection.getPrimaryId();
    if (!id || !levelManager.currentLevelId) return null;
    const scene = levelManager.getLevelScene(levelManager.currentLevelId);
    if (!scene) return null;
    const e = scene.entities.find((x) => x.id === id);
    if (!e || !isMepFixtureEntity(e)) return null;
    return e;
  }, [levelManager, universalSelection]);

  /**
   * Dispatch the params patch through `UpdateMepFixtureParamsCommand` so the
   * change is undoable + geometry/validation recompute atomically.
   */
  const dispatchParams = useCallback(
    (fixture: MepFixtureEntity, nextParams: MepFixtureParams): void => {
      if (!levelManager.currentLevelId) return;
      const sm = new LevelSceneManagerAdapter(
        levelManager.getLevelScene,
        levelManager.setLevelScene,
        levelManager.currentLevelId,
      );
      executeCommand(
        new UpdateMepFixtureParamsCommand(fixture.id, nextParams, fixture.params, sm, false),
      );
      EventBus.emit('bim:mep-fixture-params-updated', { fixtureId: fixture.id });
    },
    [executeCommand, levelManager],
  );

  const getComboboxState = useCallback(
    (commandKey: string): RibbonComboboxState | null => {
      const fixture = resolveFixture();
      if (!fixture) return null;
      if (commandKey === MEP_FIXTURE_RIBBON_KEYS.stringParams.shape) {
        return { value: fixture.params.shape, options: [] };
      }
      if (isMepFixtureRibbonKey(commandKey)) {
        const field = NUMBER_KEY_TO_FIELD[commandKey];
        const raw = fixture.params[field];
        if (typeof raw !== 'number') return null;
        return { value: String(Math.round(raw)), options: [] };
      }
      return null;
    },
    [resolveFixture],
  );

  const onComboboxChange = useCallback(
    (commandKey: string, value: string): void => {
      const fixture = resolveFixture();
      if (!fixture) return;
      if (commandKey === MEP_FIXTURE_RIBBON_KEYS.stringParams.shape) {
        const nextParams: MepFixtureParams = {
          ...fixture.params,
          shape: value as MepFixtureShape,
        };
        dispatchParams(fixture, nextParams);
        return;
      }
      if (isMepFixtureRibbonKey(commandKey)) {
        const numeric = Number.parseFloat(value);
        if (Number.isNaN(numeric)) return;
        const field = NUMBER_KEY_TO_FIELD[commandKey];
        const nextParams = { ...fixture.params, [field]: numeric } as MepFixtureParams;
        dispatchParams(fixture, nextParams);
      }
    },
    [resolveFixture, dispatchParams],
  );

  // Toggles unused — included για interface parity με τα υπόλοιπα bridges.
  const onToggle = useCallback((_key: string, _next: boolean): void => {
    /* no-op */
  }, []);

  const getToggleState = useCallback((_key: string): RibbonToggleState => NULL_TOGGLE, []);

  // ADR-408 Φ7 — the circuit the selected fixture belongs to (Revit single-
  // circuit ⇒ at most one). Honours the synced `activeSystemId` so it matches the
  // read-only indicator widget, falling back to the first candidate.
  const resolveFixtureCircuit = useCallback(() => {
    const fixture = resolveFixture();
    if (!fixture) return null;
    const systems = useMepSystemStore.getState().getSystems();
    const candidates = resolveManagedCircuits([fixture], systems);
    if (candidates.length === 0) return null;
    const activeId = useMepCircuitEditorStore.getState().activeSystemId;
    return candidates.find((c) => c.id === activeId) ?? candidates[0]!;
  }, [resolveFixture]);

  const onAction = useCallback(
    (action: string): void => {
      if (action === MEP_FIXTURE_RIBBON_KEYS_ACTIONS.editCircuit) {
        // Revit "Select Panel" / "Edit Circuit": select the circuit's source
        // panel so the panel-centric circuit tab surfaces in manage mode. The
        // active circuit stays the fixture's (reconciled by useMepCircuitEditorSync).
        const circuit = resolveFixtureCircuit();
        if (!circuit) return;
        useMepCircuitEditorStore.getState().setActiveSystemId(circuit.id);
        universalSelection.select(circuit.params.sourceEntityId, 'dxf-entity');
        return;
      }
      if (action !== MEP_FIXTURE_RIBBON_KEYS_ACTIONS.delete) return;
      const fixture = resolveFixture();
      if (!fixture) return;
      const confirmed = window.confirm(
        t('ribbon.commands.mepFixtureEditor.deleteConfirm'),
      );
      if (!confirmed) return;
      EventBus.emit('bim:mep-fixture-delete-requested', { fixtureId: fixture.id });
    },
    [resolveFixture, resolveFixtureCircuit, universalSelection, t],
  );

  const getPanelVisibility = useCallback(
    (visibilityKey: string): boolean => {
      if (!isMepFixtureVisibilityKey(visibilityKey)) return true;
      const fixture = resolveFixture();
      if (!fixture) return false;
      if (visibilityKey === MEP_FIXTURE_RIBBON_VISIBILITY_KEYS.rectangularParams) {
        return fixture.params.shape === 'rectangular';
      }
      if (visibilityKey === MEP_FIXTURE_RIBBON_VISIBILITY_KEYS.hasCircuit) {
        // ADR-408 Φ7 — circuit panel visible iff the fixture is wired to a circuit.
        return resolveFixtureCircuit() !== null;
      }
      return false;
    },
    [resolveFixture, resolveFixtureCircuit],
  );

  return useMemo(
    () => ({ onComboboxChange, getComboboxState, onToggle, getToggleState, onAction, getPanelVisibility }),
    [onComboboxChange, getComboboxState, onToggle, getToggleState, onAction, getPanelVisibility],
  );
}

/** Type guard used by `useRibbonCommands` composer (panel visibility). */
export function isMepFixturePanelVisibilityKey(visibilityKey: string): boolean {
  return isMepFixtureVisibilityKey(visibilityKey);
}

/** Exposed so action interceptor μπορεί να αναγνωρίσει `mepFixture.actions.close`. */
export const MEP_FIXTURE_BRIDGE_ACTIONS = MEP_FIXTURE_RIBBON_KEYS_ACTIONS;
