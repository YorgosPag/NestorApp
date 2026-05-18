'use client';

/**
 * ADR-363 Phase 3.7 — Bridge μεταξύ contextual Slab-Opening ribbon tab και
 * active `SlabOpeningEntity` params.
 *
 * Mirrors `useRibbonSlabBridge`: read state via `getComboboxState`, write via
 * `onComboboxChange`. Κάθε mutation routes μέσω `UpdateSlabOpeningParamsCommand`
 * (undoable + geometry/validation recompute atomically).
 *
 * No-ops για commandKeys εκτός `SLAB_OPENING_RIBBON_KEYS`.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md §5.5 §11.Q3
 */

import { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { isSlabOpeningEntity } from '../../../types/entities';
import type { SlabOpeningEntity, SlabOpeningKind, SlabOpeningParams } from '../../../bim/types/slab-opening-types';
import { useCommandHistory } from '../../../core/commands';
import { UpdateSlabOpeningParamsCommand } from '../../../core/commands/entity-commands/UpdateSlabOpeningParamsCommand';
import { LevelSceneManagerAdapter } from '../../../systems/entity-creation/LevelSceneManagerAdapter';
import {
  SLAB_OPENING_RIBBON_KEYS,
  SLAB_OPENING_RIBBON_KEYS_ACTIONS,
  SLAB_OPENING_RIBBON_BADGE_KEYS,
  isSlabOpeningRibbonStringKey,
} from './bridge/slab-opening-command-keys';
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

export interface UseRibbonSlabOpeningBridgeProps {
  readonly levelManager: LevelManagerLike;
  readonly universalSelection: UniversalSelectionLike;
}

export interface RibbonSlabOpeningBridge {
  readonly onComboboxChange: (commandKey: string, value: string) => void;
  readonly getComboboxState: (commandKey: string) => RibbonComboboxState | null;
  readonly onToggle: (commandKey: string, nextValue: boolean) => void;
  readonly getToggleState: (commandKey: string) => RibbonToggleState;
  readonly getBadgeState: (badgeKey: string) => boolean;
  readonly onAction: (action: string) => void;
}

const SLAB_OPENING_OWNED_BADGE_KEYS: ReadonlySet<string> = new Set<string>([
  SLAB_OPENING_RIBBON_BADGE_KEYS.violations,
]);

const NULL_TOGGLE: RibbonToggleState = false;

const STRING_KEY_TO_FIELD: Readonly<Record<string, keyof SlabOpeningParams>> = {
  [SLAB_OPENING_RIBBON_KEYS.stringParams.kind]: 'kind',
};

export function useRibbonSlabOpeningBridge(
  props: UseRibbonSlabOpeningBridgeProps,
): RibbonSlabOpeningBridge {
  const { levelManager, universalSelection } = props;
  const { execute: executeCommand } = useCommandHistory();
  const { t } = useTranslation('dxf-viewer-shell');

  const resolveOpening = useCallback((): SlabOpeningEntity | null => {
    const id = universalSelection.getPrimaryId();
    if (!id || !levelManager.currentLevelId) return null;
    const scene = levelManager.getLevelScene(levelManager.currentLevelId);
    if (!scene) return null;
    const e = scene.entities.find((x) => x.id === id);
    if (!e || !isSlabOpeningEntity(e)) return null;
    return e;
  }, [levelManager, universalSelection]);

  const dispatchParams = useCallback(
    (opening: SlabOpeningEntity, nextParams: SlabOpeningParams): void => {
      if (!levelManager.currentLevelId) return;
      const sm = new LevelSceneManagerAdapter(
        levelManager.getLevelScene,
        levelManager.setLevelScene,
        levelManager.currentLevelId,
      );
      executeCommand(
        new UpdateSlabOpeningParamsCommand(opening.id, nextParams, opening.params, sm, false),
      );
      EventBus.emit('bim:slab-opening-params-updated', { slabOpeningId: opening.id });
    },
    [executeCommand, levelManager],
  );

  const getComboboxState = useCallback(
    (commandKey: string): RibbonComboboxState | null => {
      const opening = resolveOpening();
      if (!opening) return null;
      if (isSlabOpeningRibbonStringKey(commandKey)) {
        const field = STRING_KEY_TO_FIELD[commandKey];
        const raw = opening.params[field];
        return raw == null ? null : { value: String(raw), options: [] };
      }
      return null;
    },
    [resolveOpening],
  );

  const onComboboxChange = useCallback(
    (commandKey: string, value: string): void => {
      const opening = resolveOpening();
      if (!opening) return;
      if (isSlabOpeningRibbonStringKey(commandKey)) {
        const field = STRING_KEY_TO_FIELD[commandKey];
        if (field === 'kind') {
          const nextParams: SlabOpeningParams = { ...opening.params, kind: value as SlabOpeningKind };
          dispatchParams(opening, nextParams);
        }
      }
    },
    [resolveOpening, dispatchParams],
  );

  const onToggle = useCallback((_key: string, _next: boolean): void => {
    /* no-op Phase 3.7 */
  }, []);

  const getToggleState = useCallback((_key: string): RibbonToggleState => NULL_TOGGLE, []);

  const getBadgeState = useCallback((badgeKey: string): boolean => {
    if (!SLAB_OPENING_OWNED_BADGE_KEYS.has(badgeKey)) return false;
    const opening = resolveOpening();
    if (!opening) return false;
    if (badgeKey === SLAB_OPENING_RIBBON_BADGE_KEYS.violations) {
      return opening.validation.hasCodeViolations;
    }
    return false;
  }, [resolveOpening]);

  const onAction = useCallback(
    (action: string): void => {
      if (action !== SLAB_OPENING_RIBBON_KEYS_ACTIONS.delete) return;
      const opening = resolveOpening();
      if (!opening) return;
      const confirmed = window.confirm(
        t('ribbon.commands.slabOpeningEditor.deleteConfirm'),
      );
      if (!confirmed) return;
      EventBus.emit('bim:slab-opening-delete-requested', { slabOpeningId: opening.id });
    },
    [resolveOpening, t],
  );

  return useMemo(
    () => ({ onComboboxChange, getComboboxState, onToggle, getToggleState, getBadgeState, onAction }),
    [onComboboxChange, getComboboxState, onToggle, getToggleState, getBadgeState, onAction],
  );
}

/** Type guard used by `useRibbonCommands` composer. */
export function isSlabOpeningBadgeKey(badgeKey: string): boolean {
  return SLAB_OPENING_OWNED_BADGE_KEYS.has(badgeKey);
}

/** Exposed so action interceptor μπορεί να αναγνωρίσει `slabOpening.actions.close`. */
export const SLAB_OPENING_BRIDGE_ACTIONS = SLAB_OPENING_RIBBON_KEYS_ACTIONS;
