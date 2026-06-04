'use client';

/**
 * ADR-408 Φ12 — Bridge μεταξύ του contextual MEP manifold ribbon tab και του
 * active `MepManifoldEntity` params.
 *
 * Mirror του `useRibbonMepFixtureBridge` (selected-entity branch). Κάθε combobox
 * change δρομολογείται μέσω `UpdateMepManifoldParamsCommand`
 * (`useCommandHistory().execute`) ώστε η αλλαγή να είναι undoable + geometry/
 * validation να επανυπολογίζονται atomically. `useMepManifoldPersistence` picks up
 * την αλλαγή μέσω debounced auto-save.
 *
 * ⚠️ Re-seed connectors: ο `UpdateMepManifoldParamsCommand` ΔΕΝ ξανακάνει seed
 * connectors. Επειδή `outletCount` / `width` / διάμετροι επηρεάζουν το connector
 * layout, ο bridge ξαναχτίζει `connectors` μέσω `buildMepManifoldConnectors`
 * (idempotent SSoT) μέσα στο patch ΠΡΙΝ το dispatch — έτσι outlets ↔ connectors
 * μένουν σε συγχρονισμό (όπως το completion στη δημιουργία).
 *
 * No-ops για commandKeys εκτός `MEP_MANIFOLD_RIBBON_KEYS` ώστε να composeί με τα
 * υπόλοιπα bridges στο `useRibbonCommands`.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-408-mep-connectors-and-systems.md
 */

import { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { isMepManifoldEntity } from '../../../types/entities';
import type {
  MepManifoldEntity,
  MepManifoldParams,
} from '../../../bim/types/mep-manifold-types';
import {
  MAX_MANIFOLD_OUTLET_COUNT,
  MIN_MANIFOLD_OUTLET_COUNT,
} from '../../../bim/types/mep-manifold-types';
import { buildMepManifoldConnectors } from '../../../bim/mep-manifolds/mep-manifold-geometry';
import { useCommandHistory } from '../../../core/commands';
import { UpdateMepManifoldParamsCommand } from '../../../core/commands/entity-commands/UpdateMepManifoldParamsCommand';
import { LevelSceneManagerAdapter } from '../../../systems/entity-creation/LevelSceneManagerAdapter';
import {
  MEP_MANIFOLD_RIBBON_KEYS,
  MEP_MANIFOLD_RIBBON_KEYS_ACTIONS,
  MEP_MANIFOLD_RIBBON_VISIBILITY_KEYS,
  isMepManifoldRibbonKey,
  isMepManifoldVisibilityKey,
} from './bridge/mep-manifold-command-keys';
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
  'getPrimaryId' | 'clearAll'
>;

export interface UseRibbonMepManifoldBridgeProps {
  readonly levelManager: LevelManagerLike;
  readonly universalSelection: UniversalSelectionLike;
}

export interface RibbonMepManifoldBridge {
  readonly onComboboxChange: (commandKey: string, value: string) => void;
  readonly getComboboxState: (commandKey: string) => RibbonComboboxState | null;
  readonly onToggle: (commandKey: string, nextValue: boolean) => void;
  readonly getToggleState: (commandKey: string) => RibbonToggleState;
  readonly onAction: (action: string) => void;
  readonly getPanelVisibility: (visibilityKey: string) => boolean;
}

/** commandKey → numeric `MepManifoldParams` field. */
const NUMBER_KEY_TO_FIELD: Readonly<Record<string, keyof MepManifoldParams>> = {
  [MEP_MANIFOLD_RIBBON_KEYS.params.width]: 'width',
  [MEP_MANIFOLD_RIBBON_KEYS.params.length]: 'length',
  [MEP_MANIFOLD_RIBBON_KEYS.params.bodyHeight]: 'bodyHeightMm',
  [MEP_MANIFOLD_RIBBON_KEYS.params.mountingElevation]: 'mountingElevationMm',
  [MEP_MANIFOLD_RIBBON_KEYS.params.outletCount]: 'outletCount',
  [MEP_MANIFOLD_RIBBON_KEYS.params.inletDiameter]: 'inletDiameterMm',
  [MEP_MANIFOLD_RIBBON_KEYS.params.outletDiameter]: 'outletDiameterMm',
};

const NULL_TOGGLE: RibbonToggleState = false;

export function useRibbonMepManifoldBridge(
  props: UseRibbonMepManifoldBridgeProps,
): RibbonMepManifoldBridge {
  const { levelManager, universalSelection } = props;
  const { execute: executeCommand } = useCommandHistory();
  const { t } = useTranslation('dxf-viewer-shell');

  const resolveManifold = useCallback((): MepManifoldEntity | null => {
    const id = universalSelection.getPrimaryId();
    if (!id || !levelManager.currentLevelId) return null;
    const scene = levelManager.getLevelScene(levelManager.currentLevelId);
    if (!scene) return null;
    const e = scene.entities.find((x) => x.id === id);
    if (!e || !isMepManifoldEntity(e)) return null;
    return e;
  }, [levelManager, universalSelection]);

  /**
   * Dispatch the params patch through `UpdateMepManifoldParamsCommand`. Connectors
   * are re-seeded from the next params (idempotent SSoT) so outlet count / width /
   * diameters keep the embedded connector set consistent.
   */
  const dispatchParams = useCallback(
    (manifold: MepManifoldEntity, nextParams: MepManifoldParams): void => {
      if (!levelManager.currentLevelId) return;
      const withConnectors: MepManifoldParams = {
        ...nextParams,
        connectors: buildMepManifoldConnectors(nextParams),
      };
      const sm = new LevelSceneManagerAdapter(
        levelManager.getLevelScene,
        levelManager.setLevelScene,
        levelManager.currentLevelId,
      );
      executeCommand(
        new UpdateMepManifoldParamsCommand(manifold.id, withConnectors, manifold.params, sm, false),
      );
    },
    [executeCommand, levelManager],
  );

  const getComboboxState = useCallback(
    (commandKey: string): RibbonComboboxState | null => {
      const manifold = resolveManifold();
      if (!manifold) return null;
      if (isMepManifoldRibbonKey(commandKey)) {
        const field = NUMBER_KEY_TO_FIELD[commandKey];
        const raw = manifold.params[field];
        if (typeof raw !== 'number') return null;
        return { value: String(Math.round(raw)), options: [] };
      }
      return null;
    },
    [resolveManifold],
  );

  const onComboboxChange = useCallback(
    (commandKey: string, value: string): void => {
      const manifold = resolveManifold();
      if (!manifold) return;
      if (!isMepManifoldRibbonKey(commandKey)) return;
      const numeric = Number.parseFloat(value);
      if (Number.isNaN(numeric)) return;
      const field = NUMBER_KEY_TO_FIELD[commandKey];
      // Outlet count is an integer clamped to [MIN, MAX] (validation refuses 0).
      const next =
        field === 'outletCount'
          ? Math.max(MIN_MANIFOLD_OUTLET_COUNT, Math.min(MAX_MANIFOLD_OUTLET_COUNT, Math.round(numeric)))
          : numeric;
      const nextParams = { ...manifold.params, [field]: next } as MepManifoldParams;
      dispatchParams(manifold, nextParams);
    },
    [resolveManifold, dispatchParams],
  );

  // Toggles unused — interface parity με τα υπόλοιπα bridges.
  const onToggle = useCallback((_key: string, _next: boolean): void => {
    /* no-op */
  }, []);
  const getToggleState = useCallback((_key: string): RibbonToggleState => NULL_TOGGLE, []);

  const onAction = useCallback(
    (action: string): void => {
      if (action === MEP_MANIFOLD_RIBBON_KEYS_ACTIONS.close) {
        universalSelection.clearAll();
        return;
      }
      if (action !== MEP_MANIFOLD_RIBBON_KEYS_ACTIONS.delete) return;
      const manifold = resolveManifold();
      if (!manifold) return;
      const confirmed = window.confirm(t('ribbon.commands.mepManifoldEditor.deleteConfirm'));
      if (!confirmed) return;
      EventBus.emit('bim:mep-manifold-delete-requested', { manifoldId: manifold.id });
    },
    [resolveManifold, universalSelection, t],
  );

  const getPanelVisibility = useCallback(
    (visibilityKey: string): boolean => {
      if (!isMepManifoldVisibilityKey(visibilityKey)) return true;
      const manifold = resolveManifold();
      if (!manifold) return false;
      if (visibilityKey === MEP_MANIFOLD_RIBBON_VISIBILITY_KEYS.hasNetwork) {
        // ADR-408 Φ13 fold-in — «Δίκτυο» panel visible iff the manifold sources ≥1
        // plumbing network (Revit "System Properties" from the equipment).
        const systems = useMepSystemStore.getState().getSystems();
        return resolveManagedSystems([manifold], systems).length > 0;
      }
      return false;
    },
    [resolveManifold],
  );

  return useMemo(
    () => ({ onComboboxChange, getComboboxState, onToggle, getToggleState, onAction, getPanelVisibility }),
    [onComboboxChange, getComboboxState, onToggle, getToggleState, onAction, getPanelVisibility],
  );
}

/** Type guard used by `useRibbonCommands` composer (panel visibility). */
export function isMepManifoldPanelVisibilityKey(visibilityKey: string): boolean {
  return isMepManifoldVisibilityKey(visibilityKey);
}
