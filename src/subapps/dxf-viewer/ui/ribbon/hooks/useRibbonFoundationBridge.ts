'use client';

/**
 * ADR-436 Slice 1 — Bridge μεταξύ contextual Foundation ribbon tab και active
 * `FoundationEntity` params (ή του `useFoundationTool` handle σε drawing mode).
 *
 * Mirror του `useRibbonColumnBridge`: read state via `getComboboxState`, write via
 * `onComboboxChange`. Κάθε mutation σε επιλεγμένο entity περνά από
 * `UpdateFoundationParamsCommand` (undoable + geometry/validation recompute
 * atomically). Σε drawing mode (καμία επιλογή) οι αλλαγές πάνε στο
 * `foundationToolBridgeStore` ώστε το επόμενο click να δημιουργεί pad με τα
 * επιλεγμένα params.
 *
 * No-ops για commandKeys εκτός `FOUNDATION_RIBBON_KEYS` ώστε να composeί με τα
 * υπόλοιπα bridges στο `useRibbonCommands`.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-436-bim-foundation-discipline.md §6
 */

import { useCallback, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { isFoundationEntity } from '../../../types/entities';
import { hasGuideBindings } from '../../../bim/hosting/guide-binding-types';
import {
  DEFAULT_STRIP_JUSTIFICATION,
  type FoundationAnchor,
  type FoundationEntity,
  type FoundationKind,
  type FoundationParams,
  type StripJustification,
} from '../../../bim/types/foundation-types';
import { useCommandHistory } from '../../../core/commands';
import { UpdateFoundationParamsCommand } from '../../../core/commands/entity-commands/UpdateFoundationParamsCommand';
import { RehostFoundationsCommand } from '../../../core/commands/entity-commands/RehostFoundationsCommand';
import { CompoundCommand } from '../../../core/commands/CompoundCommand';
import type { ICommand } from '../../../core/commands/interfaces';
import { LevelSceneManagerAdapter } from '../../../systems/entity-creation/LevelSceneManagerAdapter';
import { computeGridJunctionExtends } from '../../../bim/foundations/foundation-grid-junctions';
import { computeFoundationGeometry } from '../../../bim/geometry/foundation-geometry';
import type { SceneModel } from '../../../types/scene';
// ADR-441 Slice 2 — «Εσχάρα πεδιλοδοκών από κάναβο» (one-shot ribbon action).
import { getGlobalGuideStore } from '../../../systems/guides/guide-store';
import { resolveSceneUnits } from '../../../utils/scene-units';
import { EventBus } from '../../../systems/events/EventBus';
import {
  commitFoundationGridFromGuides,
  type FoundationGridCommitResult,
} from '../../../bim/foundations/foundation-grid-commit';
import {
  FOUNDATION_RIBBON_KEYS,
  FOUNDATION_RIBBON_KEYS_ACTIONS,
  FOUNDATION_RIBBON_BADGE_KEYS,
  FOUNDATION_RIBBON_VISIBILITY_KEYS,
  isFoundationRibbonKey,
  isFoundationRibbonStringKey,
} from './bridge/foundation-command-keys';
import { foundationToolBridgeStore } from './bridge/foundation-tool-bridge-store';
import type { FoundationToolBridgeHandle } from './bridge/foundation-tool-bridge-store';
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
  'getPrimaryId' | 'getSelectedEntityIds'
>;

export interface UseRibbonFoundationBridgeProps {
  readonly levelManager: LevelManagerLike;
  readonly universalSelection: UniversalSelectionLike;
}

export interface RibbonFoundationBridge {
  readonly onComboboxChange: (commandKey: string, value: string) => void;
  readonly getComboboxState: (commandKey: string) => RibbonComboboxState | null;
  readonly onToggle: (commandKey: string, nextValue: boolean) => void;
  readonly getToggleState: (commandKey: string) => RibbonToggleState;
  readonly getBadgeState: (badgeKey: string) => boolean;
  readonly onAction: (action: string) => void;
  readonly getPanelVisibility: (visibilityKey: string) => boolean;
}

/** command-key → override field name (matches FoundationParamOverrides keys). */
const NUMBER_KEY_TO_OVERRIDE: Readonly<Record<string, string>> = {
  [FOUNDATION_RIBBON_KEYS.params.width]: 'width',
  [FOUNDATION_RIBBON_KEYS.params.length]: 'length',
  [FOUNDATION_RIBBON_KEYS.params.thickness]: 'thicknessMm',
  [FOUNDATION_RIBBON_KEYS.params.rotation]: 'rotation',
  [FOUNDATION_RIBBON_KEYS.params.topElevation]: 'topElevationMm',
};

const FOUNDATION_OWNED_BADGE_KEYS: ReadonlySet<string> = new Set<string>([
  FOUNDATION_RIBBON_BADGE_KEYS.violations,
]);

const NULL_TOGGLE: RibbonToggleState = false;

/**
 * ADR-441 Slice 8 — όταν αλλάζει η έδραση/πλάτος μιας grid-managed λωρίδας, ανα-υπολογίζει
 * τα junction-miter extends ΟΛΩΝ των λωρίδων του level (με την edited νέα γεωμετρία) και
 * επιστρέφει command για τους **γείτονες** (η ίδια η edited ενημερώνεται από το
 * UpdateFoundationParamsCommand). `null` αν δεν είναι grid-managed ή κανείς γείτονας δεν άλλαξε.
 */
function junctionNeighborCommand(
  edited: FoundationEntity,
  nextParams: FoundationParams,
  scene: SceneModel,
  adapter: LevelSceneManagerAdapter,
): ICommand | null {
  if (!hasGuideBindings(edited) || !('start' in nextParams)) return null;
  const editedNext: FoundationEntity = {
    ...edited, params: nextParams, geometry: computeFoundationGeometry(nextParams),
  };
  const set = scene.entities
    .filter(isFoundationEntity)
    .map((s) => (s.id === edited.id ? editedNext : s));
  const neighbors = computeGridJunctionExtends(set).filter((j) => j.rehosted.id !== edited.id);
  return neighbors.length > 0 ? new RehostFoundationsCommand(neighbors, adapter) : null;
}

export function useRibbonFoundationBridge(
  props: UseRibbonFoundationBridgeProps,
): RibbonFoundationBridge {
  const { levelManager, universalSelection } = props;
  const { execute: executeCommand } = useCommandHistory();
  const { t } = useTranslation('dxf-viewer-shell');

  const toolHandle = foundationToolBridgeStore.use();

  const resolveFoundation = useCallback((): FoundationEntity | null => {
    const id = universalSelection.getPrimaryId();
    if (!id || !levelManager.currentLevelId) return null;
    const scene = levelManager.getLevelScene(levelManager.currentLevelId);
    if (!scene) return null;
    const e = scene.entities.find((x) => x.id === id);
    if (!e || !isFoundationEntity(e)) return null;
    return e;
  }, [levelManager, universalSelection]);

  const dispatchParams = useCallback(
    (foundation: FoundationEntity, nextParams: FoundationParams): void => {
      const levelId = levelManager.currentLevelId;
      if (!levelId) return;
      const sm = new LevelSceneManagerAdapter(
        levelManager.getLevelScene,
        levelManager.setLevelScene,
        levelId,
      );
      const update = new UpdateFoundationParamsCommand(foundation.id, nextParams, foundation.params, sm, false);
      // ADR-441 Slice 8 — αλλαγή έδρασης/πλάτους grid λωρίδας → ανα-υπολογισμός joins
      // ώστε οι γειτονικές λωρίδες να κλείσουν/ανοίξουν τις γωνίες live (Revit auto-join).
      const scene = levelManager.getLevelScene(levelId);
      const junction = scene ? junctionNeighborCommand(foundation, nextParams, scene, sm) : null;
      executeCommand(junction ? new CompoundCommand('Update foundation + junctions', [update, junction]) : update);
    },
    [executeCommand, levelManager],
  );

  const getComboboxState = useCallback(
    (commandKey: string): RibbonComboboxState | null => {
      const foundation = resolveFoundation();
      // ── SELECTED ENTITY BRANCH ────────────────────────────────────────────
      if (foundation) {
        if (isFoundationRibbonStringKey(commandKey)) {
          const s = readSelectedStringField(foundation.params, commandKey);
          return s === null ? null : { value: s, options: [] };
        }
        if (isFoundationRibbonKey(commandKey)) {
          const raw = readNumberField(foundation.params, commandKey);
          if (raw === null) return null;
          return { value: String(Math.round(raw)), options: [] };
        }
        return null;
      }
      // ── DRAWING-MODE BRANCH (no selection, tool active) ──────────────────
      if (!toolHandle || !toolHandle.isActive) return null;
      if (isFoundationRibbonStringKey(commandKey)) {
        const s = readToolStringField(toolHandle, commandKey);
        return s === null ? null : { value: s, options: [] };
      }
      if (isFoundationRibbonKey(commandKey)) {
        const field = NUMBER_KEY_TO_OVERRIDE[commandKey];
        const raw = (toolHandle.overrides as Record<string, unknown>)[field];
        if (typeof raw !== 'number') return null;
        return { value: String(Math.round(raw)), options: [] };
      }
      return null;
    },
    [resolveFoundation, toolHandle],
  );

  const onComboboxChange = useCallback(
    (commandKey: string, value: string): void => {
      const foundation = resolveFoundation();
      // ── SELECTED ENTITY BRANCH ────────────────────────────────────────────
      if (foundation) {
        if (isFoundationRibbonStringKey(commandKey)) {
          const next = nextParamsForStringChange(foundation.params, commandKey, value);
          if (next) dispatchParams(foundation, next);
          return;
        }
        if (isFoundationRibbonKey(commandKey)) {
          const numeric = Number.parseFloat(value);
          if (Number.isNaN(numeric)) return;
          const next = writeNumberField(foundation.params, commandKey, numeric);
          if (next) dispatchParams(foundation, next);
        }
        return;
      }
      // ── DRAWING-MODE BRANCH ───────────────────────────────────────────────
      const handle = foundationToolBridgeStore.get();
      if (!handle || !handle.isActive) return;
      if (isFoundationRibbonStringKey(commandKey)) {
        applyStringChangeToHandle(handle, commandKey, value);
        return;
      }
      if (isFoundationRibbonKey(commandKey)) {
        const numeric = Number.parseFloat(value);
        if (Number.isNaN(numeric)) return;
        const field = NUMBER_KEY_TO_OVERRIDE[commandKey];
        handle.setParamOverrides({ [field]: numeric });
      }
    },
    [resolveFoundation, dispatchParams],
  );

  const onToggle = useCallback((_key: string, _next: boolean): void => {
    /* no-op Slice 1 */
  }, []);

  const getToggleState = useCallback((_key: string): RibbonToggleState => NULL_TOGGLE, []);

  const getBadgeState = useCallback((badgeKey: string): boolean => {
    if (!FOUNDATION_OWNED_BADGE_KEYS.has(badgeKey)) return false;
    const foundation = resolveFoundation();
    if (!foundation) return false;
    return foundation.validation.hasCodeViolations;
  }, [resolveFoundation]);

  // ADR-441 Slice 2+6 — managed reconcile εσχάρας από τον κάναβο (atomic, 1 undo).
  // SSoT call: χρησιμοποιείται από το κουμπί «Εσχάρα» ΚΑΙ από το auto-trigger (Slice 7).
  const runFoundationGridCommit = useCallback((): FoundationGridCommitResult | null => {
    const levelId = levelManager.currentLevelId;
    if (!levelId) return null;
    const scene = levelManager.getLevelScene(levelId);
    return commitFoundationGridFromGuides({
      guideReader: getGlobalGuideStore(),
      getLevelScene: levelManager.getLevelScene,
      setLevelScene: levelManager.setLevelScene,
      levelId,
      sceneUnits: scene ? resolveSceneUnits(scene) : 'mm',
      executeCommand,
    });
  }, [levelManager, executeCommand]);

  // ADR-441 Slice 6 — idempotent re-run: το 'up-to-date' ΔΕΝ είναι αποτυχία (Revit
  // «ενημερωμένο»). Εκπέμπεται ως success-style summary με created=0,deleted=0.
  const emitFromGridToast = useCallback((result: FoundationGridCommitResult): void => {
    if (result.ok || result.reason === 'up-to-date') {
      EventBus.emit('bim:foundations-from-grid', {
        created: result.created,
        deleted: result.deleted,
        rehosted: result.rehosted,
        reJustified: result.reJustified,
      });
    } else {
      EventBus.emit('bim:foundations-from-grid-failed', { reason: result.reason ?? 'empty' });
    }
  }, []);

  // Κουμπί «Εσχάρα» (one-shot): τρέχει το reconcile και **πάντα** δείχνει toast.
  const handleFromGrid = useCallback((): void => {
    const result = runFoundationGridCommit();
    if (result) emitFromGridToast(result);
  }, [runFoundationGridCommit, emitFromGridToast]);

  // ADR-441 Slice 7 — auto re-split/reflow στο follow-move: όταν ένας άξονας «κάθεται»
  // μετά από μετακίνηση (`bim:grid-guides-settled`), τρέχει το ΙΔΙΟ managed reconcile
  // αυτόματα. Gate: μόνο αν υπάρχει ήδη grid-managed εσχάρα (ΜΗΝ auto-create στο αρχικό
  // draw του κανάβου — αυτό μένει ρητή ενέργεια του μηχανικού). Toast μόνο αν όντως
  // άλλαξε κάτι (split/reflow/rehost) → μηδέν spam σε απλή μετακίνηση χωρίς cross.
  useEffect(() => {
    const off = EventBus.on('bim:grid-guides-settled', ({ levelId }) => {
      // [ADR441-DIAG] TEMP — αφαίρεση πριν commit (Slice 10 crossing investigation)
      console.debug('[ADR441-DIAG] settle-event', { levelId, current: levelManager.currentLevelId });
      if (levelManager.currentLevelId !== levelId) return;
      const scene = levelManager.getLevelScene(levelId);
      const gridCount = scene ? scene.entities.filter((e) => isFoundationEntity(e) && hasGuideBindings(e)).length : 0;
      console.debug('[ADR441-DIAG] settle gate', { hasScene: !!scene, gridCount });
      if (!scene || !scene.entities.some((e) => isFoundationEntity(e) && hasGuideBindings(e))) return;
      const result = runFoundationGridCommit();
      console.debug('[ADR441-DIAG] auto-commit result', result);
      if (
        result?.ok &&
        result.created + result.deleted + result.reJustified + result.rehosted > 0
      ) {
        emitFromGridToast(result);
      }
    });
    return off;
  }, [levelManager, runFoundationGridCommit, emitFromGridToast]);

  const onAction = useCallback(
    (action: string): void => {
      if (action === FOUNDATION_RIBBON_KEYS_ACTIONS.fromGrid) return handleFromGrid();
      if (action !== FOUNDATION_RIBBON_KEYS_ACTIONS.delete) return;
      const foundation = resolveFoundation();
      if (!foundation || !levelManager.currentLevelId) return;
      const confirmed = window.confirm(t('ribbon.commands.foundationEditor.deleteConfirm'));
      if (!confirmed) return;
      const scene = levelManager.getLevelScene(levelManager.currentLevelId);
      if (!scene) return;
      // Slice 1 — direct scene removal (Firestore persistence + undoable delete
      // command land στο Slice 1-persist· το standard Delete-key path καλύπτει
      // ήδη undoable διαγραφή μέσω selection).
      levelManager.setLevelScene(levelManager.currentLevelId, {
        ...scene,
        entities: scene.entities.filter((e) => e.id !== foundation.id),
      });
    },
    [resolveFoundation, levelManager, t, handleFromGrid],
  );

  // ADR-436 Slice 2 — kind-conditional panels. Resolve the active kind (selected
  // entity, else the active tool handle) → pad-only vs line-only panel visibility.
  const getPanelVisibility = useCallback((visibilityKey: string): boolean => {
    const foundation = resolveFoundation();
    const kind: FoundationKind | null = foundation
      ? foundation.params.kind
      : (toolHandle?.isActive ? toolHandle.kind : null);
    if (kind === null) return true; // no context → show all (defensive)
    const isLine = kind === 'strip' || kind === 'tie-beam';
    if (visibilityKey === FOUNDATION_RIBBON_VISIBILITY_KEYS.padOnly) return kind === 'pad';
    if (visibilityKey === FOUNDATION_RIBBON_VISIBILITY_KEYS.lineOnly) return isLine;
    return true;
  }, [resolveFoundation, toolHandle]);

  return useMemo(
    () => ({ onComboboxChange, getComboboxState, onToggle, getToggleState, getBadgeState, onAction, getPanelVisibility }),
    [onComboboxChange, getComboboxState, onToggle, getToggleState, getBadgeState, onAction, getPanelVisibility],
  );
}

// ─── String-field read/write helpers (discriminated-union-safe) ──────────────

/** Selected-entity string-combobox value. null = combobox δεν ισχύει για το kind. */
function readSelectedStringField(params: FoundationParams, commandKey: string): string | null {
  if (commandKey === FOUNDATION_RIBBON_KEYS.stringParams.kind) return params.kind;
  if (commandKey === FOUNDATION_RIBBON_KEYS.stringParams.anchor) {
    return params.kind === 'pad' ? params.anchor : 'center';
  }
  if (commandKey === FOUNDATION_RIBBON_KEYS.stringParams.material) return params.material ?? 'rc';
  // ADR-441 Slice 5a-control — justification μόνο για strip/tie-beam (pad → anchor).
  if (commandKey === FOUNDATION_RIBBON_KEYS.stringParams.justification) {
    return params.kind === 'pad' ? null : (params.justification ?? DEFAULT_STRIP_JUSTIFICATION);
  }
  return null;
}

/** Drawing-mode (tool handle) string-combobox value. null = δεν ισχύει για το kind. */
function readToolStringField(handle: FoundationToolBridgeHandle, commandKey: string): string | null {
  if (commandKey === FOUNDATION_RIBBON_KEYS.stringParams.kind) return handle.kind;
  if (commandKey === FOUNDATION_RIBBON_KEYS.stringParams.anchor) return handle.anchor;
  if (commandKey === FOUNDATION_RIBBON_KEYS.stringParams.material) {
    return typeof handle.overrides.material === 'string' ? handle.overrides.material : null;
  }
  if (commandKey === FOUNDATION_RIBBON_KEYS.stringParams.justification) {
    return handle.kind === 'pad' ? null : (handle.overrides.justification ?? DEFAULT_STRIP_JUSTIFICATION);
  }
  return null;
}

/** Next params for a string-combobox change on a selected foundation. null = no-op. */
function nextParamsForStringChange(
  params: FoundationParams,
  commandKey: string,
  value: string,
): FoundationParams | null {
  // ADR-436 Slice 2 — kind = DISPLAY-ONLY (pad↔line geometrically invalid). No-op.
  if (commandKey === FOUNDATION_RIBBON_KEYS.stringParams.kind) return null;
  if (commandKey === FOUNDATION_RIBBON_KEYS.stringParams.anchor) {
    return params.kind === 'pad' ? { ...params, anchor: value as FoundationAnchor } : null;
  }
  if (commandKey === FOUNDATION_RIBBON_KEYS.stringParams.material) {
    return { ...params, material: value };
  }
  if (commandKey === FOUNDATION_RIBBON_KEYS.stringParams.justification) {
    // ADR-441 5a-grid — χειροκίνητη υπεροχή: flag ώστε το managed reconcile να μην το επαναφέρει.
    return params.kind === 'pad'
      ? null
      : { ...params, justification: value as StripJustification, justificationManual: true };
  }
  return null;
}

/** Apply a string-combobox change to the active tool handle (drawing-mode overrides). */
function applyStringChangeToHandle(
  handle: FoundationToolBridgeHandle,
  commandKey: string,
  value: string,
): void {
  // ADR-436 Slice 2 — kind fixed by tool id (DISPLAY-ONLY). No-op.
  if (commandKey === FOUNDATION_RIBBON_KEYS.stringParams.kind) return;
  if (commandKey === FOUNDATION_RIBBON_KEYS.stringParams.anchor) {
    handle.setAnchor(value as FoundationAnchor);
    return;
  }
  if (commandKey === FOUNDATION_RIBBON_KEYS.stringParams.material) {
    handle.setParamOverrides({ material: value });
    return;
  }
  if (commandKey === FOUNDATION_RIBBON_KEYS.stringParams.justification) {
    handle.setParamOverrides({ justification: value as StripJustification });
  }
}

// ─── Number-field read/write helpers (discriminated-union-safe) ──────────────

function readNumberField(params: FoundationParams, commandKey: string): number | null {
  if (commandKey === FOUNDATION_RIBBON_KEYS.params.width) return params.width;
  if (commandKey === FOUNDATION_RIBBON_KEYS.params.thickness) return params.thicknessMm;
  if (commandKey === FOUNDATION_RIBBON_KEYS.params.topElevation) return params.topElevationMm;
  if (commandKey === FOUNDATION_RIBBON_KEYS.params.length) {
    return params.kind === 'pad' ? params.length : null;
  }
  if (commandKey === FOUNDATION_RIBBON_KEYS.params.rotation) {
    return params.kind === 'pad' ? params.rotation : null;
  }
  return null;
}

function writeNumberField(
  params: FoundationParams,
  commandKey: string,
  value: number,
): FoundationParams | null {
  if (commandKey === FOUNDATION_RIBBON_KEYS.params.width) return { ...params, width: value };
  if (commandKey === FOUNDATION_RIBBON_KEYS.params.thickness) return { ...params, thicknessMm: value };
  if (commandKey === FOUNDATION_RIBBON_KEYS.params.topElevation) return { ...params, topElevationMm: value };
  if (commandKey === FOUNDATION_RIBBON_KEYS.params.length) {
    return params.kind === 'pad' ? { ...params, length: value } : null;
  }
  if (commandKey === FOUNDATION_RIBBON_KEYS.params.rotation) {
    return params.kind === 'pad' ? { ...params, rotation: value } : null;
  }
  return null;
}

/** Type guards used by `useRibbonCommands` composer. */
export function isFoundationBadgeKeyComposer(badgeKey: string): boolean {
  return FOUNDATION_OWNED_BADGE_KEYS.has(badgeKey);
}

export const FOUNDATION_BRIDGE_ACTIONS = FOUNDATION_RIBBON_KEYS_ACTIONS;
