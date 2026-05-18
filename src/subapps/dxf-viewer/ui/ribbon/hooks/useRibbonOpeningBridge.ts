'use client';

/**
 * ADR-363 Phase 2 — Bridge μεταξύ contextual Opening ribbon tab και
 * active `OpeningEntity` params.
 *
 * Mirrors `useRibbonWallBridge`: read state via `getComboboxState`, write via
 * `onComboboxChange`. Phase 2 mutations bypass `CommandHistory` (full undo/
 * redo lands Phase 2.5 με `UpdateOpeningParamsCommand`) — instead the bridge
 * patches the scene directly + re-derives geometry. `useOpeningPersistence`
 * picks up the change via debounced auto-save.
 *
 * No-ops for commandKeys outside `OPENING_RIBBON_KEYS` so it composes με τα
 * stair / wall / array / text bridges στο `useRibbonCommands`.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md §5.4 §5.9
 */

import { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { isOpeningEntity, isWallEntity } from '../../../types/entities';
import type { OpeningEntity, OpeningKind, OpeningParams } from '../../../bim/types/opening-types';
import { computeOpeningGeometry } from '../../../bim/geometry/opening-geometry';
import { validateOpeningParams } from '../../../bim/validators/opening-validator';
import type { WallEntity } from '../../../bim/types/wall-types';
import {
  OPENING_RIBBON_KEYS,
  OPENING_RIBBON_KEYS_ACTIONS,
  OPENING_RIBBON_BADGE_KEYS,
  isOpeningRibbonKey,
  isOpeningRibbonStringKey,
} from './bridge/opening-command-keys';
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
};

export function useRibbonOpeningBridge(
  props: UseRibbonOpeningBridgeProps,
): RibbonOpeningBridge {
  const { levelManager, universalSelection } = props;
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

  const resolveHostWall = useCallback((opening: OpeningEntity): WallEntity | null => {
    if (!levelManager.currentLevelId) return null;
    const scene = levelManager.getLevelScene(levelManager.currentLevelId);
    if (!scene) return null;
    const w = scene.entities.find((x) => x.id === opening.params.wallId);
    if (!w || !isWallEntity(w)) return null;
    return w;
  }, [levelManager]);

  /**
   * Patch the opening's params in scene + re-derive geometry + validation.
   * Auto-save picks it up via `useOpeningPersistence` debounce.
   */
  const dispatchParams = useCallback(
    (opening: OpeningEntity, nextParams: OpeningParams): void => {
      if (!levelManager.currentLevelId) return;
      const scene = levelManager.getLevelScene(levelManager.currentLevelId);
      if (!scene) return;
      const host = resolveHostWall(opening);
      if (!host) return;
      const geometry = computeOpeningGeometry(nextParams, host);
      const validation = validateOpeningParams(nextParams, host).bimValidation;
      const updated: OpeningEntity = { ...opening, params: nextParams, geometry, validation };
      const nextEntities = scene.entities.map((e) => (e.id === opening.id ? updated : e));
      levelManager.setLevelScene(levelManager.currentLevelId, {
        ...scene,
        entities: nextEntities,
      });
      EventBus.emit('bim:opening-params-updated', { openingId: opening.id });
    },
    [levelManager, resolveHostWall],
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
      if (action !== OPENING_RIBBON_KEYS_ACTIONS.delete) return;
      const opening = resolveOpening();
      if (!opening) return;
      const confirmed = window.confirm(
        t('ribbon.commands.openingEditor.deleteConfirm'),
      );
      if (!confirmed) return;
      EventBus.emit('bim:opening-delete-requested', { openingId: opening.id });
    },
    [resolveOpening, t],
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
