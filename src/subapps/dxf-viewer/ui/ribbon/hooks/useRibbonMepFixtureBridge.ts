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
import { isSanitaryKind } from '../../../bim/sanitary/sanitary-symbol-spec';
import { isApplianceKind } from '../../../bim/appliances/appliance-symbol-spec';
import {
  fixtureMeshPresetsForKind,
  resolveFixtureMeshPreset,
} from '../../../bim/mep-fixtures/plumbing-fixture-spec';
import { SELECT_CLEAR_VALUE, isSelectClearValue } from '@/config/domain-constants';
import { useCommandHistory } from '../../../core/commands';
import { UpdateMepFixtureParamsCommand } from '../../../core/commands/entity-commands/UpdateMepFixtureParamsCommand';
import { createLevelSceneManagerAdapter } from '../../../systems/entity-creation/LevelSceneManagerAdapter';
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
import { resolveManagedSystems } from '../../../bim/mep-systems/mep-circuit-editor';
import type {
  RibbonComboboxState,
  RibbonToggleState,
} from '../context/RibbonCommandContext';
import type { LevelSceneWriter } from '../../../systems/levels/level-scene-accessor';
import type { useUniversalSelection } from '../../../systems/selection';

type UniversalSelectionLike = Pick<
  ReturnType<typeof useUniversalSelection>,
  'getPrimaryId' | 'getSelectedEntityIds' | 'select'
>;

export interface UseRibbonMepFixtureBridgeProps {
  readonly levelManager: LevelSceneWriter;
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
      const sm = createLevelSceneManagerAdapter(
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
      if (commandKey === MEP_FIXTURE_RIBBON_KEYS.stringParams.assetId) {
        // ADR-411 / ADR-408 Δρόμος B — 3D representation picker. Clear sentinel =
        // parametric box; a catalog id = realistic glTF mesh. Revit-correct: the
        // dropdown lists ONLY the meshes of THIS fixture's kind (a WC must not offer
        // shower models; a washing machine offers only appliance meshes), via the
        // `fixtureMeshPresetsForKind` family-dispatching SSoT. Labels resolve through
        // t() in the renderer (isLiteralLabel:false) → no hardcoded strings (N.11).
        const meshPresets = fixtureMeshPresetsForKind(fixture.params.kind);
        return {
          value: fixture.params.assetId ?? SELECT_CLEAR_VALUE,
          options: [
            {
              value: SELECT_CLEAR_VALUE,
              labelKey: 'ribbon.commands.mepSanitaryFixtureEditor.threeDViewParametric',
              isLiteralLabel: false,
            },
            ...meshPresets.map((p) => ({
              value: p.id,
              labelKey: p.labelKey,
              isLiteralLabel: false,
            })),
          ],
        };
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
      if (commandKey === MEP_FIXTURE_RIBBON_KEYS.stringParams.assetId) {
        // ADR-411 — the clear sentinel resets the mesh override (parametric box).
        // A mesh preset only applies to a fixture of the SAME kind (Revit-correct: a
        // shower mesh must not land on a WC, a washing-machine mesh not on a basin) —
        // resolved across BOTH family catalogs via `resolveFixtureMeshPreset`.
        const nextAssetId = isSelectClearValue(value) ? undefined : value;
        if (!nextAssetId) {
          // Clearing the mesh keeps the current footprint (least-surprise — the
          // user can still resize the parametric box manually).
          dispatchParams(fixture, { ...fixture.params, assetId: undefined });
          return;
        }
        const preset = resolveFixtureMeshPreset(nextAssetId);
        if (!preset || preset.kind !== fixture.params.kind) return;
        // Adopt the mesh's authored footprint (Revit "Type" sizing): the 2D symbol,
        // selection box, grips and the drain connector all recompute to the mesh's
        // real plan extent — keeping the 2D footprint aligned with the 3D cabin and
        // the recentred mesh origin (ADR-411 2D polish, issue #1).
        dispatchParams(fixture, {
          ...fixture.params,
          assetId: nextAssetId,
          shape: 'rectangular',
          width: preset.widthMm,
          length: preset.depthMm,
        });
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
    const candidates = resolveManagedSystems([fixture], systems);
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
      // ADR-408 Φ14 / Δρόμος B — floor drain + sanitary terminals + appliances each
      // show their own delete prompt; all kinds share this bridge + delete path
      // (`bim:mep-fixture-delete-requested`).
      const confirmKey = fixture.params.kind === 'floor-drain'
        ? 'ribbon.commands.mepFloorDrainEditor.deleteConfirm'
        : isApplianceKind(fixture.params.kind)
          ? 'ribbon.commands.mepApplianceFixtureEditor.deleteConfirm'
          : isSanitaryKind(fixture.params.kind)
            ? 'ribbon.commands.mepSanitaryFixtureEditor.deleteConfirm'
            : 'ribbon.commands.mepFixtureEditor.deleteConfirm';
      const confirmed = window.confirm(t(confirmKey));
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
