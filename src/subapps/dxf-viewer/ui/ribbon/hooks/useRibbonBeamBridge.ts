'use client';

/**
 * ADR-363 Phase 5 / 5.5a — Bridge μεταξύ contextual Beam ribbon tab και active
 * `BeamEntity` params.
 *
 * Mirrors `useRibbonSlabBridge`: read state via `getComboboxState`, write via
 * `onComboboxChange`. Phase 5.5a routes every mutation through
 * `UpdateBeamParamsCommand` (via `useCommandHistory().execute`) ώστε η αλλαγή
 * να είναι undoable + geometry/validation να επανυπολογίζονται atomically.
 * `useBeamPersistence` picks up την αλλαγή μέσω debounced auto-save. Ribbon
 * edits χρησιμοποιούν `isDragging=false` ώστε κάθε edit να είναι δικό του
 * undo entry (drag merging ζει στο grip-commit path).
 *
 * No-ops για commandKeys εκτός `BEAM_RIBBON_KEYS` ώστε να composeί με τα
 * άλλα bridges στο `useRibbonCommands`.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md §5.7 §6 Phase 5.5a
 */

import { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { isBeamEntity } from '../../../types/entities';
import type {
  BeamEntity,
  BeamKind,
  BeamParams,
  BeamSectionType,
  BeamSupportType,
} from '../../../bim/types/beam-types';
import { useCommandHistory } from '../../../core/commands';
import { UpdateBeamParamsCommand } from '../../../core/commands/entity-commands/UpdateBeamParamsCommand';
import { LevelSceneManagerAdapter } from '../../../systems/entity-creation/LevelSceneManagerAdapter';
import {
  BEAM_RIBBON_KEYS,
  BEAM_RIBBON_KEYS_ACTIONS,
  BEAM_RIBBON_BADGE_KEYS,
  isBeamRibbonKey,
  isBeamRibbonStringKey,
} from './bridge/beam-command-keys';
import { PSET_RIBBON_ACTION } from './bridge/pset-action-keys';
import { EventBus } from '../../../systems/events/EventBus';
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
  'getPrimaryId'
>;

export interface UseRibbonBeamBridgeProps {
  readonly levelManager: LevelManagerLike;
  readonly universalSelection: UniversalSelectionLike;
}

export interface RibbonBeamBridge {
  readonly onComboboxChange: (commandKey: string, value: string) => void;
  readonly getComboboxState: (commandKey: string) => RibbonComboboxState | null;
  readonly onToggle: (commandKey: string, nextValue: boolean) => void;
  readonly getToggleState: (commandKey: string) => RibbonToggleState;
  readonly getBadgeState: (badgeKey: string) => boolean;
  readonly onAction: (action: string) => void;
}

const BEAM_OWNED_BADGE_KEYS: ReadonlySet<string> = new Set<string>([
  BEAM_RIBBON_BADGE_KEYS.violations,
]);

const NULL_TOGGLE: RibbonToggleState = false;

const NUMBER_KEY_TO_FIELD: Readonly<Record<string, keyof BeamParams>> = {
  [BEAM_RIBBON_KEYS.params.width]:        'width',
  [BEAM_RIBBON_KEYS.params.depth]:        'depth',
  [BEAM_RIBBON_KEYS.params.topElevation]: 'topElevation',
};

const STRING_KEY_TO_FIELD: Readonly<Record<string, keyof BeamParams>> = {
  [BEAM_RIBBON_KEYS.stringParams.kind]:                'kind',
  [BEAM_RIBBON_KEYS.stringParams.supportType]:         'supportType',
  [BEAM_RIBBON_KEYS.stringParams.material]:            'material',
  [BEAM_RIBBON_KEYS.stringParams.sectionType]:         'sectionType',
  [BEAM_RIBBON_KEYS.stringParams.profileDesignation]:  'profileDesignation',
};

export function useRibbonBeamBridge(
  props: UseRibbonBeamBridgeProps,
): RibbonBeamBridge {
  const { levelManager, universalSelection } = props;
  const { execute: executeCommand } = useCommandHistory();
  const { t } = useTranslation('dxf-viewer-shell');

  const resolveBeam = useCallback((): BeamEntity | null => {
    const id = universalSelection.getPrimaryId();
    if (!id || !levelManager.currentLevelId) return null;
    const scene = levelManager.getLevelScene(levelManager.currentLevelId);
    if (!scene) return null;
    const e = scene.entities.find((x) => x.id === id);
    if (!e || !isBeamEntity(e)) return null;
    return e;
  }, [levelManager, universalSelection]);

  /**
   * Dispatch the params patch through `UpdateBeamParamsCommand` so the change
   * is undoable + geometry/validation recompute atomically (ADR-363 Phase 5.5a).
   * `useBeamPersistence` picks up the patched entity via debounced auto-save.
   */
  const dispatchParams = useCallback(
    (beam: BeamEntity, nextParams: BeamParams): void => {
      if (!levelManager.currentLevelId) return;
      const sm = new LevelSceneManagerAdapter(
        levelManager.getLevelScene,
        levelManager.setLevelScene,
        levelManager.currentLevelId,
      );
      executeCommand(
        new UpdateBeamParamsCommand(beam.id, nextParams, beam.params, sm, false),
      );
      EventBus.emit('bim:beam-params-updated', { beamId: beam.id });
    },
    [executeCommand, levelManager],
  );

  const getComboboxState = useCallback(
    (commandKey: string): RibbonComboboxState | null => {
      const beam = resolveBeam();
      if (!beam) return null;
      if (isBeamRibbonStringKey(commandKey)) {
        const field = STRING_KEY_TO_FIELD[commandKey];
        const raw = beam.params[field];
        // ADR-363 Phase 5.5c — surface 'rc' as the active selection when
        // `params.material` is undefined; mirrors the `resolveBeamMaterialKey`
        // fallback used by `BeamRenderer.drawMaterialHatch`.
        if (raw == null) {
          if (field === 'material') return { value: 'rc', options: [] };
          return null;
        }
        return { value: String(raw), options: [] };
      }
      if (isBeamRibbonKey(commandKey)) {
        const field = NUMBER_KEY_TO_FIELD[commandKey];
        const raw = beam.params[field];
        if (typeof raw !== 'number') return null;
        return { value: String(Math.round(raw)), options: [] };
      }
      return null;
    },
    [resolveBeam],
  );

  const onComboboxChange = useCallback(
    (commandKey: string, value: string): void => {
      const beam = resolveBeam();
      if (!beam) return;

      if (isBeamRibbonStringKey(commandKey)) {
        const field = STRING_KEY_TO_FIELD[commandKey];
        if (field === 'kind') {
          const nextParams: BeamParams = { ...beam.params, kind: value as BeamKind };
          dispatchParams(beam, nextParams);
          return;
        }
        if (field === 'supportType') {
          const nextParams: BeamParams = { ...beam.params, supportType: value as BeamSupportType };
          dispatchParams(beam, nextParams);
          return;
        }
        if (field === 'material') {
          const nextParams: BeamParams = { ...beam.params, material: value };
          dispatchParams(beam, nextParams);
          return;
        }
        if (field === 'sectionType') {
          const nextParams: BeamParams = { ...beam.params, sectionType: value as BeamSectionType };
          dispatchParams(beam, nextParams);
          return;
        }
        if (field === 'profileDesignation') {
          const nextParams: BeamParams = { ...beam.params, profileDesignation: value || undefined };
          dispatchParams(beam, nextParams);
          return;
        }
        return;
      }

      if (isBeamRibbonKey(commandKey)) {
        const numeric = Number.parseFloat(value);
        if (Number.isNaN(numeric)) return;
        const field = NUMBER_KEY_TO_FIELD[commandKey];
        const nextParams: BeamParams = { ...beam.params, [field]: numeric } as BeamParams;
        dispatchParams(beam, nextParams);
      }
    },
    [resolveBeam, dispatchParams],
  );

  const onToggle = useCallback((_key: string, _next: boolean): void => {
    /* no-op Phase 5 */
  }, []);

  const getToggleState = useCallback((_key: string): RibbonToggleState => NULL_TOGGLE, []);

  const getBadgeState = useCallback((badgeKey: string): boolean => {
    if (!BEAM_OWNED_BADGE_KEYS.has(badgeKey)) return false;
    const beam = resolveBeam();
    if (!beam) return false;
    if (badgeKey === BEAM_RIBBON_BADGE_KEYS.violations) {
      return beam.validation.hasCodeViolations;
    }
    return false;
  }, [resolveBeam]);

  const onAction = useCallback(
    (action: string): void => {
      if (action === PSET_RIBBON_ACTION) {
        const beam = resolveBeam();
        if (!beam || !levelManager.currentLevelId) return;
        EventBus.emit('bim:pset-editor-open', {
          entityId: beam.id,
          levelId: levelManager.currentLevelId,
          entityType: 'beam',
        });
        return;
      }
      if (action !== BEAM_RIBBON_KEYS_ACTIONS.delete) return;
      const beam = resolveBeam();
      if (!beam) return;
      const confirmed = window.confirm(
        t('ribbon.commands.beamEditor.deleteConfirm'),
      );
      if (!confirmed) return;
      EventBus.emit('bim:beam-delete-requested', { beamId: beam.id });
    },
    [resolveBeam, levelManager, t],
  );

  return useMemo(
    () => ({ onComboboxChange, getComboboxState, onToggle, getToggleState, getBadgeState, onAction }),
    [onComboboxChange, getComboboxState, onToggle, getToggleState, getBadgeState, onAction],
  );
}

/** Type guard used by `useRibbonCommands` composer. */
export function isBeamBadgeKey(badgeKey: string): boolean {
  return BEAM_OWNED_BADGE_KEYS.has(badgeKey);
}

/** Exposed so action interceptor μπορεί να αναγνωρίσει `beam.actions.close`. */
export const BEAM_BRIDGE_ACTIONS = BEAM_RIBBON_KEYS_ACTIONS;
