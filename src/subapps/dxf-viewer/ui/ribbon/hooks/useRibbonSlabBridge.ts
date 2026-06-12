'use client';

/**
 * ADR-363 Phase 3 / 3.5 — Bridge μεταξύ contextual Slab ribbon tab και active
 * `SlabEntity` params.
 *
 * Mirrors `useRibbonOpeningBridge`: read state via `getComboboxState`, write
 * via `onComboboxChange`. Phase 3.5 routes every mutation through
 * `UpdateSlabParamsCommand` (via `useCommandHistory().execute`) so the change
 * is undoable + geometry/validation recompute atomically. `useSlabPersistence`
 * picks up την αλλαγή μέσω debounced auto-save. Ribbon edits use
 * `isDragging=false` so each edit is its own undo entry (drag merging lives
 * in the grip-commit path).
 *
 * No-ops για commandKeys εκτός `SLAB_RIBBON_KEYS` ώστε να composeί με τα
 * stair / wall / opening / array / text bridges στο `useRibbonCommands`.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md §5.5 §6 Phase 3.5
 */

import { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { isSlabEntity } from '../../../types/entities';
import type { SlabEntity, SlabKind, SlabParams, SlabReinforcement } from '../../../bim/types/slab-types';
import { useCommandHistory } from '../../../core/commands';
import { UpdateSlabParamsCommand } from '../../../core/commands/entity-commands/UpdateSlabParamsCommand';
import { LevelSceneManagerAdapter } from '../../../systems/entity-creation/LevelSceneManagerAdapter';
import {
  SLAB_RIBBON_KEYS,
  SLAB_RIBBON_KEYS_ACTIONS,
  SLAB_RIBBON_BADGE_KEYS,
  isSlabRibbonKey,
  isSlabRibbonStringKey,
} from './bridge/slab-command-keys';
import { PSET_RIBBON_ACTION } from './bridge/pset-action-keys';
import { EventBus } from '../../../systems/events/EventBus';
// ADR-441 Slice GEN-SLAB — one-shot «Πλάκες από κάναβο» (εδαφόπλακα ενιαία).
import {
  commitFoundationMatFromGuides,
  type SlabGridCommitResult,
} from '../../../bim/slabs/slab-grid-commit';
import { resolveSceneUnits } from '../../../utils/scene-units';
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

export interface UseRibbonSlabBridgeProps {
  readonly levelManager: LevelManagerLike;
  readonly universalSelection: UniversalSelectionLike;
}

export interface RibbonSlabBridge {
  readonly onComboboxChange: (commandKey: string, value: string) => void;
  readonly getComboboxState: (commandKey: string) => RibbonComboboxState | null;
  readonly onToggle: (commandKey: string, nextValue: boolean) => void;
  readonly getToggleState: (commandKey: string) => RibbonToggleState;
  /** Returns `true` όταν το currently selected slab έχει code violations. */
  readonly getBadgeState: (badgeKey: string) => boolean;
  /** Handles ribbon simple-button actions (close / delete). */
  readonly onAction: (action: string) => void;
}

const SLAB_OWNED_BADGE_KEYS: ReadonlySet<string> = new Set<string>([
  SLAB_RIBBON_BADGE_KEYS.violations,
]);

const NULL_TOGGLE: RibbonToggleState = false;

/**
 * ADR-441 Slice GEN-SLAB — toast μετά το «Πλάκες από κάναβο». Το `up-to-date` (υπάρχει
 * ήδη εδαφόπλακα) ΔΕΝ είναι αποτυχία: εκπέμπεται ως success-style summary με created=0.
 */
function emitSlabsFromGridToast(result: SlabGridCommitResult): void {
  if (result.ok || result.reason === 'up-to-date') {
    EventBus.emit('bim:slabs-from-grid', { created: result.created, skipped: result.skipped });
  } else {
    EventBus.emit('bim:slabs-from-grid-failed', { reason: result.reason ?? 'no-footprint' });
  }
}

const NUMBER_KEY_TO_FIELD: Readonly<Record<string, keyof SlabParams>> = {
  [SLAB_RIBBON_KEYS.params.thickness]: 'thickness',
  [SLAB_RIBBON_KEYS.params.levelElevation]: 'levelElevation',
};

const STRING_KEY_TO_FIELD: Readonly<Record<string, keyof SlabParams>> = {
  [SLAB_RIBBON_KEYS.stringParams.kind]: 'kind',
  [SLAB_RIBBON_KEYS.stringParams.reinforcement]: 'reinforcement',
  [SLAB_RIBBON_KEYS.stringParams.material]: 'material',
};

export function useRibbonSlabBridge(
  props: UseRibbonSlabBridgeProps,
): RibbonSlabBridge {
  const { levelManager, universalSelection } = props;
  const { execute: executeCommand } = useCommandHistory();
  const { t } = useTranslation('dxf-viewer-shell');

  const resolveSlab = useCallback((): SlabEntity | null => {
    const id = universalSelection.getPrimaryId();
    if (!id || !levelManager.currentLevelId) return null;
    const scene = levelManager.getLevelScene(levelManager.currentLevelId);
    if (!scene) return null;
    const e = scene.entities.find((x) => x.id === id);
    if (!e || !isSlabEntity(e)) return null;
    return e;
  }, [levelManager, universalSelection]);

  /**
   * Dispatch the params patch through `UpdateSlabParamsCommand` so the change
   * is undoable + geometry/validation recompute atomically.
   * `useSlabPersistence` picks up the patched entity via debounced auto-save.
   */
  const dispatchParams = useCallback(
    (slab: SlabEntity, nextParams: SlabParams): void => {
      if (!levelManager.currentLevelId) return;
      const sm = new LevelSceneManagerAdapter(
        levelManager.getLevelScene,
        levelManager.setLevelScene,
        levelManager.currentLevelId,
      );
      executeCommand(
        new UpdateSlabParamsCommand(slab.id, nextParams, slab.params, sm, false),
      );
      EventBus.emit('bim:slab-params-updated', { slabId: slab.id });
    },
    [executeCommand, levelManager],
  );

  const getComboboxState = useCallback(
    (commandKey: string): RibbonComboboxState | null => {
      const slab = resolveSlab();
      if (!slab) return null;
      if (isSlabRibbonStringKey(commandKey)) {
        const field = STRING_KEY_TO_FIELD[commandKey];
        const raw = slab.params[field];
        return raw == null ? null : { value: String(raw), options: [] };
      }
      if (isSlabRibbonKey(commandKey)) {
        const field = NUMBER_KEY_TO_FIELD[commandKey];
        const raw = slab.params[field];
        if (typeof raw !== 'number') return null;
        return { value: String(Math.round(raw)), options: [] };
      }
      return null;
    },
    [resolveSlab],
  );

  const onComboboxChange = useCallback(
    (commandKey: string, value: string): void => {
      const slab = resolveSlab();
      if (!slab) return;

      if (isSlabRibbonStringKey(commandKey)) {
        const field = STRING_KEY_TO_FIELD[commandKey];
        if (field === 'kind') {
          const nextParams: SlabParams = { ...slab.params, kind: value as SlabKind };
          dispatchParams(slab, nextParams);
          return;
        }
        if (field === 'reinforcement') {
          const nextParams: SlabParams = { ...slab.params, reinforcement: value as SlabReinforcement };
          dispatchParams(slab, nextParams);
          return;
        }
        if (field === 'material') {
          const nextParams: SlabParams = { ...slab.params, material: value || undefined };
          dispatchParams(slab, nextParams);
          return;
        }
        return;
      }

      if (isSlabRibbonKey(commandKey)) {
        const numeric = Number.parseFloat(value);
        if (Number.isNaN(numeric)) return;
        const field = NUMBER_KEY_TO_FIELD[commandKey];
        const nextParams: SlabParams = { ...slab.params, [field]: numeric } as SlabParams;
        dispatchParams(slab, nextParams);
      }
    },
    [resolveSlab, dispatchParams],
  );

  // Toggles unused Phase 3 — included για interface parity.
  const onToggle = useCallback((_key: string, _next: boolean): void => {
    /* no-op Phase 3 */
  }, []);

  const getToggleState = useCallback((_key: string): RibbonToggleState => NULL_TOGGLE, []);

  const getBadgeState = useCallback((badgeKey: string): boolean => {
    if (!SLAB_OWNED_BADGE_KEYS.has(badgeKey)) return false;
    const slab = resolveSlab();
    if (!slab) return false;
    if (badgeKey === SLAB_RIBBON_BADGE_KEYS.violations) {
      return slab.validation.hasCodeViolations;
    }
    return false;
  }, [resolveSlab]);

  // ADR-441 Slice GEN-SLAB — one-shot «Εδαφόπλακα από κάναβο»: ΕΝΑ ενιαίο slab
  // kind='foundation' σε όλο το αποτύπωμα (idempotent). Δεν θέλει επιλεγμένη πλάκα.
  const handleFoundationMatFromGrid = useCallback((): void => {
    const levelId = levelManager.currentLevelId;
    if (!levelId) return;
    const scene = levelManager.getLevelScene(levelId);
    const result = commitFoundationMatFromGuides({
      getLevelScene: levelManager.getLevelScene,
      setLevelScene: levelManager.setLevelScene,
      levelId,
      sceneUnits: scene ? resolveSceneUnits(scene) : 'mm',
      executeCommand,
    });
    emitSlabsFromGridToast(result);
  }, [levelManager, executeCommand]);

  const onAction = useCallback(
    (action: string): void => {
      // ADR-441 Slice GEN-SLAB — grid actions: ΔΕΝ θέλουν επιλεγμένη πλάκα (πριν resolveSlab).
      if (action === SLAB_RIBBON_KEYS_ACTIONS.fromGridMat) { handleFoundationMatFromGrid(); return; }
      if (action === PSET_RIBBON_ACTION) {
        const slab = resolveSlab();
        if (!slab || !levelManager.currentLevelId) return;
        EventBus.emit('bim:pset-editor-open', {
          entityId: slab.id,
          levelId: levelManager.currentLevelId,
          entityType: 'slab',
        });
        return;
      }
      if (action !== SLAB_RIBBON_KEYS_ACTIONS.delete) return;
      const slab = resolveSlab();
      if (!slab) return;
      const confirmed = window.confirm(
        t('ribbon.commands.slabEditor.deleteConfirm'),
      );
      if (!confirmed) return;
      EventBus.emit('bim:slab-delete-requested', { slabId: slab.id });
    },
    [resolveSlab, levelManager, t, handleFoundationMatFromGrid],
  );

  return useMemo(
    () => ({ onComboboxChange, getComboboxState, onToggle, getToggleState, getBadgeState, onAction }),
    [onComboboxChange, getComboboxState, onToggle, getToggleState, getBadgeState, onAction],
  );
}

/** Type guard used by `useRibbonCommands` composer. */
export function isSlabBadgeKey(badgeKey: string): boolean {
  return SLAB_OWNED_BADGE_KEYS.has(badgeKey);
}

/** Exposed so action interceptor μπορεί να αναγνωρίσει `slab.actions.close`. */
export const SLAB_BRIDGE_ACTIONS = SLAB_RIBBON_KEYS_ACTIONS;
