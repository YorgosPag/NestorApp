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

import { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { isFoundationEntity } from '../../../types/entities';
import type {
  FoundationAnchor,
  FoundationEntity,
  FoundationKind,
  FoundationParams,
} from '../../../bim/types/foundation-types';
import { useCommandHistory } from '../../../core/commands';
import { UpdateFoundationParamsCommand } from '../../../core/commands/entity-commands/UpdateFoundationParamsCommand';
import { LevelSceneManagerAdapter } from '../../../systems/entity-creation/LevelSceneManagerAdapter';
// ADR-441 Slice 2 — «Εσχάρα πεδιλοδοκών από κάναβο» (one-shot ribbon action).
import { getGlobalGuideStore } from '../../../systems/guides/guide-store';
import { resolveSceneUnits } from '../../../utils/scene-units';
import { EventBus } from '../../../systems/events/EventBus';
import { commitFoundationGridFromGuides } from '../../../bim/foundations/foundation-grid-commit';
import {
  FOUNDATION_RIBBON_KEYS,
  FOUNDATION_RIBBON_KEYS_ACTIONS,
  FOUNDATION_RIBBON_BADGE_KEYS,
  FOUNDATION_RIBBON_VISIBILITY_KEYS,
  isFoundationRibbonKey,
  isFoundationRibbonStringKey,
} from './bridge/foundation-command-keys';
import { foundationToolBridgeStore } from './bridge/foundation-tool-bridge-store';
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
      if (!levelManager.currentLevelId) return;
      const sm = new LevelSceneManagerAdapter(
        levelManager.getLevelScene,
        levelManager.setLevelScene,
        levelManager.currentLevelId,
      );
      executeCommand(
        new UpdateFoundationParamsCommand(foundation.id, nextParams, foundation.params, sm, false),
      );
    },
    [executeCommand, levelManager],
  );

  const getComboboxState = useCallback(
    (commandKey: string): RibbonComboboxState | null => {
      const foundation = resolveFoundation();
      // ── SELECTED ENTITY BRANCH ────────────────────────────────────────────
      if (foundation) {
        if (isFoundationRibbonStringKey(commandKey)) {
          if (commandKey === FOUNDATION_RIBBON_KEYS.stringParams.kind) {
            return { value: foundation.params.kind, options: [] };
          }
          if (commandKey === FOUNDATION_RIBBON_KEYS.stringParams.anchor) {
            const anchor = foundation.params.kind === 'pad' ? foundation.params.anchor : 'center';
            return { value: anchor, options: [] };
          }
          if (commandKey === FOUNDATION_RIBBON_KEYS.stringParams.material) {
            return { value: foundation.params.material ?? 'rc', options: [] };
          }
          return null;
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
      if (commandKey === FOUNDATION_RIBBON_KEYS.stringParams.kind) {
        return { value: toolHandle.kind, options: [] };
      }
      if (commandKey === FOUNDATION_RIBBON_KEYS.stringParams.anchor) {
        return { value: toolHandle.anchor, options: [] };
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
        if (commandKey === FOUNDATION_RIBBON_KEYS.stringParams.kind) {
          // ADR-436 Slice 2 — kind combobox = DISPLAY-ONLY (Revit 3 separate tools).
          // pad↔line είναι geometrically invalid· δεν επιτρέπουμε kind-switch. No-op.
          return;
        }
        if (commandKey === FOUNDATION_RIBBON_KEYS.stringParams.anchor) {
          if (foundation.params.kind !== 'pad') return;
          dispatchParams(foundation, { ...foundation.params, anchor: value as FoundationAnchor });
          return;
        }
        if (commandKey === FOUNDATION_RIBBON_KEYS.stringParams.material) {
          dispatchParams(foundation, { ...foundation.params, material: value });
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
      if (commandKey === FOUNDATION_RIBBON_KEYS.stringParams.kind) {
        // ADR-436 Slice 2 — kind fixed by tool id (DISPLAY-ONLY combobox). No-op.
        return;
      }
      if (commandKey === FOUNDATION_RIBBON_KEYS.stringParams.anchor) {
        handle.setAnchor(value as FoundationAnchor);
        return;
      }
      if (commandKey === FOUNDATION_RIBBON_KEYS.stringParams.material) {
        handle.setParamOverrides({ material: value });
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

  // ADR-441 Slice 2 — one-shot «Εσχάρα από κάναβο»: διαβάζει τον τρέχοντα κάναβο,
  // χτίζει born-hosted strips και τα commit-άρει ως ΕΝΑ atomic CompoundCommand-grade
  // batch (1 undo). Καμία επιλογή entity δεν απαιτείται.
  const handleFromGrid = useCallback((): void => {
    const levelId = levelManager.currentLevelId;
    if (!levelId) return;
    const scene = levelManager.getLevelScene(levelId);
    const result = commitFoundationGridFromGuides({
      guideReader: getGlobalGuideStore(),
      getLevelScene: levelManager.getLevelScene,
      setLevelScene: levelManager.setLevelScene,
      levelId,
      sceneUnits: scene ? resolveSceneUnits(scene) : 'mm',
      executeCommand,
    });
    if (result.ok) {
      EventBus.emit('bim:foundations-from-grid', { built: result.built, ignored: result.ignored });
    } else {
      EventBus.emit('bim:foundations-from-grid-failed', { reason: result.reason ?? 'empty' });
    }
  }, [levelManager, executeCommand]);

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
