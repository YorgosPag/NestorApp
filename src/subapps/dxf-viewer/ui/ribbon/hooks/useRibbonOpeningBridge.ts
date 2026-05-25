'use client';

/**
 * ADR-363 Phase 2.5 — Bridge μεταξύ contextual Opening ribbon tab και
 * active `OpeningEntity` params.
 *
 * Mirrors `useRibbonWallBridge`: read state via `getComboboxState`, write via
 * `onComboboxChange`. Phase 2.5 routes every mutation through
 * `UpdateOpeningParamsCommand` (via `useCommandHistory().execute`) so the
 * change is undoable + auto-save picks up the patched entity via
 * `useOpeningPersistence` debounce. Ribbon edits use `isDragging=false` so each
 * edit is its own undo entry (drag merging lives in the grip-commit path).
 *
 * No-ops for commandKeys outside `OPENING_RIBBON_KEYS` so it composes με τα
 * stair / wall / array / text bridges στο `useRibbonCommands`.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md §5.4 §6
 */

import { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { isOpeningEntity } from '../../../types/entities';
import type { OpeningEntity, OpeningKind, OpeningParams } from '../../../bim/types/opening-types';
import { useCommandHistory } from '../../../core/commands';
import { UpdateOpeningParamsCommand } from '../../../core/commands/entity-commands/UpdateOpeningParamsCommand';
import { LevelSceneManagerAdapter } from '../../../systems/entity-creation/LevelSceneManagerAdapter';
import {
  OPENING_RIBBON_KEYS,
  OPENING_RIBBON_KEYS_ACTIONS,
  OPENING_RIBBON_BADGE_KEYS,
  isOpeningRibbonKey,
  isOpeningRibbonStringKey,
} from './bridge/opening-command-keys';
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

export interface UseRibbonOpeningBridgeProps {
  readonly levelManager: LevelManagerLike;
  readonly universalSelection: UniversalSelectionLike;
}

export interface RibbonOpeningBridge {
  readonly onComboboxChange: (commandKey: string, value: string) => void;
  readonly getComboboxState: (commandKey: string) => RibbonComboboxState | null;
  readonly onToggle: (commandKey: string, nextValue: boolean) => void;
  readonly getToggleState: (commandKey: string) => RibbonToggleState;
  /** Returns `true` when the currently selected opening has code violations. */
  readonly getBadgeState: (badgeKey: string) => boolean;
  /** Handles ribbon simple-button actions (close / delete). */
  readonly onAction: (action: string) => void;
}

const OPENING_OWNED_BADGE_KEYS: ReadonlySet<string> = new Set<string>([
  OPENING_RIBBON_BADGE_KEYS.violations,
]);

const NULL_TOGGLE: RibbonToggleState = false;

const NUMBER_KEY_TO_FIELD: Readonly<Record<string, keyof OpeningParams>> = {
  [OPENING_RIBBON_KEYS.params.width]: 'width',
  [OPENING_RIBBON_KEYS.params.height]: 'height',
  [OPENING_RIBBON_KEYS.params.sillHeight]: 'sillHeight',
};

const STRING_KEY_TO_FIELD: Readonly<Record<string, keyof OpeningParams>> = {
  [OPENING_RIBBON_KEYS.stringParams.kind]: 'kind',
  [OPENING_RIBBON_KEYS.stringParams.handing]: 'handing',
  [OPENING_RIBBON_KEYS.stringParams.openDirection]: 'openDirection',
  [OPENING_RIBBON_KEYS.stringParams.mark]: 'mark',
};

export function useRibbonOpeningBridge(
  props: UseRibbonOpeningBridgeProps,
): RibbonOpeningBridge {
  const { levelManager, universalSelection } = props;
  const { execute: executeCommand } = useCommandHistory();
  const { t } = useTranslation('dxf-viewer-shell');

  const resolveOpening = useCallback((): OpeningEntity | null => {
    const id = universalSelection.getPrimaryId();
    if (!id || !levelManager.currentLevelId) return null;
    const scene = levelManager.getLevelScene(levelManager.currentLevelId);
    if (!scene) return null;
    const e = scene.entities.find((x) => x.id === id);
    if (!e || !isOpeningEntity(e)) return null;
    return e;
  }, [levelManager, universalSelection]);

  /**
   * Dispatch the params patch through `UpdateOpeningParamsCommand` so the
   * change is undoable + geometry/validation recompute atomically against
   * the live host wall. `useOpeningPersistence` picks up the patched entity
   * via debounced auto-save.
   */
  const dispatchParams = useCallback(
    (opening: OpeningEntity, nextParams: OpeningParams): void => {
      if (!levelManager.currentLevelId) return;
      const sm = new LevelSceneManagerAdapter(
        levelManager.getLevelScene,
        levelManager.setLevelScene,
        levelManager.currentLevelId,
      );
      executeCommand(
        new UpdateOpeningParamsCommand(opening.id, nextParams, opening.params, sm, false),
      );
      EventBus.emit('bim:opening-params-updated', { openingId: opening.id });
    },
    [executeCommand, levelManager],
  );

  const getComboboxState = useCallback(
    (commandKey: string): RibbonComboboxState | null => {
      const opening = resolveOpening();
      if (!opening) return null;
      if (isOpeningRibbonStringKey(commandKey)) {
        const field = STRING_KEY_TO_FIELD[commandKey];
        const raw = opening.params[field];
        return raw == null ? null : { value: String(raw), options: [] };
      }
      if (isOpeningRibbonKey(commandKey)) {
        const field = NUMBER_KEY_TO_FIELD[commandKey];
        const raw = opening.params[field];
        if (typeof raw !== 'number') return null;
        return { value: String(Math.round(raw)), options: [] };
      }
      return null;
    },
    [resolveOpening],
  );

  const onComboboxChange = useCallback(
    (commandKey: string, value: string): void => {
      const opening = resolveOpening();
      if (!opening) return;

      if (isOpeningRibbonStringKey(commandKey)) {
        const field = STRING_KEY_TO_FIELD[commandKey];
        const nextParams: OpeningParams = { ...opening.params, [field]: value as OpeningKind } as OpeningParams;
        // ADR-376 Phase B.1 — Mark edits flip markIsManual to true so
        // future Renumber operations preserve the user's choice by default.
        if (field === 'mark') {
          (nextParams as { -readonly [K in keyof OpeningParams]: OpeningParams[K] }).markIsManual = true;
        }
        // Switching kind also retargets defaults: if user picks a kind that has
        // no handing/openDirection (window/fixed), leave those undefined.
        dispatchParams(opening, nextParams);
        return;
      }

      if (isOpeningRibbonKey(commandKey)) {
        const numeric = Number.parseFloat(value);
        if (Number.isNaN(numeric)) return;
        const field = NUMBER_KEY_TO_FIELD[commandKey];
        const nextParams: OpeningParams = { ...opening.params, [field]: numeric } as OpeningParams;
        dispatchParams(opening, nextParams);
      }
    },
    [resolveOpening, dispatchParams],
  );

  // Toggles unused Phase 2 — included for interface parity with wall bridge.
  const onToggle = useCallback((_key: string, _next: boolean): void => {
    /* no-op Phase 2 */
  }, []);

  const getToggleState = useCallback((_key: string): RibbonToggleState => NULL_TOGGLE, []);

  const getBadgeState = useCallback((badgeKey: string): boolean => {
    if (!OPENING_OWNED_BADGE_KEYS.has(badgeKey)) return false;
    const opening = resolveOpening();
    if (!opening) return false;
    if (badgeKey === OPENING_RIBBON_BADGE_KEYS.violations) {
      return opening.validation.hasCodeViolations;
    }
    return false;
  }, [resolveOpening]);

  const onAction = useCallback(
    (action: string): void => {
      if (action === PSET_RIBBON_ACTION) {
        const opening = resolveOpening();
        if (!opening || !levelManager.currentLevelId) return;
        EventBus.emit('bim:pset-editor-open', {
          entityId: opening.id,
          levelId: levelManager.currentLevelId,
          entityType: 'opening',
        });
        return;
      }
      if (action === OPENING_RIBBON_KEYS_ACTIONS.renumber) {
        // ADR-376 Phase B.1 — Open Renumber dialog. No selection prereq —
        // the modal owns scope/kind controls and falls back to current floor.
        EventBus.emit('bim:opening-renumber-requested', {});
        return;
      }
      if (action === OPENING_RIBBON_KEYS_ACTIONS.resetTagPosition) {
        // ADR-376 Phase C.1 — clear tagOffset so the pill snaps back to the
        // auto-centroid + offset normal-to-wall outward. Field removed so the
        // Firestore document does not carry a stale {dx:0, dy:0} payload.
        const opening = resolveOpening();
        if (!opening) return;
        if (opening.params.tagOffset === undefined) return;
        const { tagOffset: _omit, ...rest } = opening.params;
        void _omit;
        dispatchParams(opening, rest as OpeningParams);
        return;
      }
      if (action !== OPENING_RIBBON_KEYS_ACTIONS.delete) return;
      const opening = resolveOpening();
      if (!opening) return;
      const confirmed = window.confirm(
        t('ribbon.commands.openingEditor.deleteConfirm'),
      );
      if (!confirmed) return;
      EventBus.emit('bim:opening-delete-requested', { openingId: opening.id });
    },
    [resolveOpening, levelManager, t],
  );

  return useMemo(
    () => ({ onComboboxChange, getComboboxState, onToggle, getToggleState, getBadgeState, onAction }),
    [onComboboxChange, getComboboxState, onToggle, getToggleState, getBadgeState, onAction],
  );
}

/** Type guard used by `useRibbonCommands` composer. */
export function isOpeningBadgeKey(badgeKey: string): boolean {
  return OPENING_OWNED_BADGE_KEYS.has(badgeKey);
}

/** Exposed so the action interceptor can recognize `opening.actions.close`. */
export const OPENING_BRIDGE_ACTIONS = OPENING_RIBBON_KEYS_ACTIONS;
