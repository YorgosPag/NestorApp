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

import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { isSlabOpeningEntity } from '../../../types/entities';
import type { SlabOpeningEntity, SlabOpeningKind, SlabOpeningParams } from '../../../bim/types/slab-opening-types';
import { useCommandHistory } from '../../../core/commands';
import { UpdateSlabOpeningParamsCommand } from '../../../core/commands/entity-commands/UpdateSlabOpeningParamsCommand';
import { createLevelSceneManagerAdapter } from '../../../systems/entity-creation/LevelSceneManagerAdapter';
import {
  SLAB_OPENING_RIBBON_KEYS,
  SLAB_OPENING_RIBBON_KEYS_ACTIONS,
  SLAB_OPENING_RIBBON_BADGE_KEYS,
  isSlabOpeningRibbonStringKey,
} from './bridge/slab-opening-command-keys';
import { SELECT_CLEAR_VALUE } from '@/config/domain-constants';
import { EventBus } from '../../../systems/events/EventBus';
import {
  useResolveSelectedEntity,
  useNoopToggles,
  useViolationBadgeState,
  useStableBridge,
} from './ribbon-entity-bridge-shared';
import type {
  RibbonComboboxState,
} from '../context/RibbonCommandContext';
import type { RibbonBridgeCore } from './bridge/ribbon-bridge-core';
import type { LevelSceneWriter } from '../../../systems/levels/level-scene-accessor';
import type { useUniversalSelection } from '../../../systems/selection';

type UniversalSelectionLike = Pick<
  ReturnType<typeof useUniversalSelection>,
  'getPrimaryId'
>;

export interface UseRibbonSlabOpeningBridgeProps {
  readonly levelManager: LevelSceneWriter;
  readonly universalSelection: UniversalSelectionLike;
}

export interface RibbonSlabOpeningBridge extends RibbonBridgeCore {
  readonly getBadgeState: (badgeKey: string) => boolean;
}

const SLAB_OPENING_OWNED_BADGE_KEYS: ReadonlySet<string> = new Set<string>([
  SLAB_OPENING_RIBBON_BADGE_KEYS.violations,
]);

const STRING_KEY_TO_FIELD: Readonly<Record<string, keyof SlabOpeningParams>> = {
  [SLAB_OPENING_RIBBON_KEYS.stringParams.kind]:       'kind',
  [SLAB_OPENING_RIBBON_KEYS.stringParams.fireRating]: 'fireRating',
};

export function useRibbonSlabOpeningBridge(
  props: UseRibbonSlabOpeningBridgeProps,
): RibbonSlabOpeningBridge {
  const { levelManager, universalSelection } = props;
  const { execute: executeCommand } = useCommandHistory();
  const { t } = useTranslation('dxf-viewer-shell');

  const resolveOpening = useResolveSelectedEntity(levelManager, universalSelection, isSlabOpeningEntity);

  const dispatchParams = useCallback(
    (opening: SlabOpeningEntity, nextParams: SlabOpeningParams): void => {
      if (!levelManager.currentLevelId) return;
      const sm = createLevelSceneManagerAdapter(
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
        // fireRating: undefined → SELECT_CLEAR_VALUE (Radix Select forbids '').
        if (field === 'fireRating') {
          return { value: raw == null ? SELECT_CLEAR_VALUE : String(raw), options: [] };
        }
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
          return;
        }
        if (field === 'fireRating') {
          const parsed =
            value === SELECT_CLEAR_VALUE || value === ''
              ? undefined
              : (Number(value) as 60 | 90 | 120);
          const nextParams: SlabOpeningParams = { ...opening.params, fireRating: parsed };
          dispatchParams(opening, nextParams);
          return;
        }
      }
    },
    [resolveOpening, dispatchParams],
  );

  const { onToggle, getToggleState } = useNoopToggles();

  const getBadgeState = useViolationBadgeState(
    resolveOpening,
    SLAB_OPENING_OWNED_BADGE_KEYS,
    SLAB_OPENING_RIBBON_BADGE_KEYS.violations,
  );

  const onAction = useCallback(
    (action: string): void => {
      if (action === SLAB_OPENING_RIBBON_KEYS_ACTIONS.delete) {
        const opening = resolveOpening();
        if (!opening) return;
        const confirmed = window.confirm(
          t('ribbon.commands.slabOpeningEditor.deleteConfirm'),
        );
        if (!confirmed) return;
        EventBus.emit('bim:slab-opening-delete-requested', { slabOpeningId: opening.id });
        return;
      }
      if (action === SLAB_OPENING_RIBBON_KEYS_ACTIONS.copyToFloors) {
        const opening = resolveOpening();
        if (opening) EventBus.emit('bim:slab-opening-stack-requested', { opening });
      }
    },
    [resolveOpening, t],
  );

  return useStableBridge({ onComboboxChange, getComboboxState, onToggle, getToggleState, getBadgeState, onAction });
}

/** Type guard used by `useRibbonCommands` composer. */
export function isSlabOpeningBadgeKey(badgeKey: string): boolean {
  return SLAB_OPENING_OWNED_BADGE_KEYS.has(badgeKey);
}

/** Exposed so action interceptor μπορεί να αναγνωρίσει `slabOpening.actions.close`. */
export const SLAB_OPENING_BRIDGE_ACTIONS = SLAB_OPENING_RIBBON_KEYS_ACTIONS;
