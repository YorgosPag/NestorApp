'use client';

/**
 * ADR-583 — Bridge between the contextual annotation-symbol (North arrow) ribbon
 * tab and EITHER (α) a selected `annotation-symbol` entity or (β) the placement
 * defaults (`annotation-symbol-selection-store`).
 *
 * Dual mode (Revit «διάλεξε στυλ → τοποθέτησε» + «επίλεξε → επεξεργάσου» — mirror
 * του `useRibbonLineToolBridge`):
 *   - Επιλεγμένος Βορράς → read/write μέσω του generic `UpdateEntityCommand`
 *     (undoable, μηδέν νέα command class). Αλλάζει το ΙΔΙΟ entity (variant/μέγεθος/
 *     γωνία) → canvas re-render.
 *   - Καμία επιλογή (εργαλείο `north-arrow` ενεργό) → read/write στο selection store
 *     (defaults για την ΕΠΟΜΕΝΗ τοποθέτηση, που διαβάζει το `handleAnnotationSymbolClick`).
 *
 * No-ops for commandKeys outside `ANNOTATION_SYMBOL_RIBBON_KEYS` so it composes with
 * the other bridges in `useRibbonCommands`.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-583-annotation-symbol-library-north-arrow.md
 */

import { useCallback, useMemo } from 'react';
import { useAnnotationSymbolSelectionStore } from '../../../state/annotation-symbol-selection-store';
import {
  ANNOTATION_SYMBOL_RIBBON_KEYS,
  isAnnotationSymbolRibbonKey,
  isAnnotationSymbolRibbonStringKey,
} from './bridge/annotation-symbol-command-keys';
import type { RibbonComboboxState, RibbonToggleState } from '../context/RibbonCommandContext';
import { listAnnotationSymbolsByKind } from '../../../config/annotation-symbol-catalog';
import type { AnnotationSymbolEntity } from '../../../types/annotation-symbol';
import { isAnnotationSymbolEntity } from '../../../types/entities';
import { useCommandHistory } from '../../../core/commands';
import { UpdateEntityCommand } from '../../../core/commands/entity-commands/UpdateEntityCommand';
import { createLevelSceneManagerAdapter } from '../../../systems/entity-creation/LevelSceneManagerAdapter';
import type { LevelSceneWriter } from '../../../systems/levels/level-scene-accessor';
import type { useUniversalSelection } from '../../../systems/selection';

type UniversalSelectionLike = Pick<ReturnType<typeof useUniversalSelection>, 'getPrimaryId'>;

export interface UseRibbonAnnotationSymbolBridgeProps {
  readonly levelManager: LevelSceneWriter;
  readonly universalSelection: UniversalSelectionLike;
}

export interface RibbonAnnotationSymbolBridge {
  readonly onComboboxChange: (commandKey: string, value: string) => void;
  readonly getComboboxState: (commandKey: string) => RibbonComboboxState | null;
  readonly onToggle: (commandKey: string, nextValue: boolean) => void;
  readonly getToggleState: (commandKey: string) => RibbonToggleState;
  readonly onAction: (action: string) => void;
  readonly getPanelVisibility: (visibilityKey: string) => boolean;
}

const NULL_TOGGLE: RibbonToggleState = false;

/** Variant options GENERATED from the catalog SSoT (never hand-listed). */
const VARIANT_OPTIONS = listAnnotationSymbolsByKind('north-arrow').map((d) => ({
  value: d.id,
  labelKey: d.labelKey,
  isLiteralLabel: false,
}));

export function useRibbonAnnotationSymbolBridge(
  props: UseRibbonAnnotationSymbolBridgeProps,
): RibbonAnnotationSymbolBridge {
  const { levelManager, universalSelection } = props;
  const { execute: executeCommand } = useCommandHistory();

  // Subscribe so the tool-active picker re-renders when the defaults change.
  const symbolId = useAnnotationSymbolSelectionStore((s) => s.symbolId);
  const sizeMm = useAnnotationSymbolSelectionStore((s) => s.sizeMm);
  const rotationDeg = useAnnotationSymbolSelectionStore((s) => s.rotationDeg);

  /** The selected annotation-symbol entity (edit mode), or null (defaults mode). */
  const resolveSelected = useCallback((): AnnotationSymbolEntity | null => {
    const id = universalSelection.getPrimaryId();
    if (!id || !levelManager.currentLevelId) return null;
    const scene = levelManager.getLevelScene(levelManager.currentLevelId);
    const e = scene?.entities.find((x) => x.id === id);
    return e && isAnnotationSymbolEntity(e) ? (e as AnnotationSymbolEntity) : null;
  }, [levelManager, universalSelection]);

  const patchEntity = useCallback(
    (entity: AnnotationSymbolEntity, patch: Record<string, unknown>): void => {
      if (!levelManager.currentLevelId) return;
      const sm = createLevelSceneManagerAdapter(
        levelManager.getLevelScene,
        levelManager.setLevelScene,
        levelManager.currentLevelId,
      );
      executeCommand(new UpdateEntityCommand(entity.id, patch, sm, 'Update annotation symbol'));
    },
    [executeCommand, levelManager],
  );

  const getComboboxState = useCallback(
    (commandKey: string): RibbonComboboxState | null => {
      const selected = resolveSelected();
      const curSymbolId = selected ? selected.symbolId : symbolId;
      const curSize = selected ? (selected.sizeMm ?? sizeMm) : sizeMm;
      const curRot = selected ? (selected.rotation ?? 0) : rotationDeg;
      if (commandKey === ANNOTATION_SYMBOL_RIBBON_KEYS.stringParams.symbolId) {
        return { value: curSymbolId, options: VARIANT_OPTIONS };
      }
      if (commandKey === ANNOTATION_SYMBOL_RIBBON_KEYS.params.sizeMm) {
        return { value: String(curSize), options: [] };
      }
      if (commandKey === ANNOTATION_SYMBOL_RIBBON_KEYS.params.rotation) {
        return { value: String(curRot), options: [] };
      }
      return null;
    },
    [resolveSelected, symbolId, sizeMm, rotationDeg],
  );

  const onComboboxChange = useCallback((commandKey: string, value: string): void => {
    const selected = resolveSelected();
    const store = useAnnotationSymbolSelectionStore.getState();
    if (commandKey === ANNOTATION_SYMBOL_RIBBON_KEYS.stringParams.symbolId) {
      if (selected) patchEntity(selected, { symbolId: value });
      else store.setSymbolId(value);
      return;
    }
    const numeric = Number.parseFloat(value);
    if (Number.isNaN(numeric)) return;
    if (commandKey === ANNOTATION_SYMBOL_RIBBON_KEYS.params.sizeMm) {
      if (numeric <= 0) return;
      if (selected) patchEntity(selected, { sizeMm: numeric });
      else store.setSizeMm(numeric);
      return;
    }
    if (commandKey === ANNOTATION_SYMBOL_RIBBON_KEYS.params.rotation) {
      if (selected) patchEntity(selected, { rotation: numeric });
      else store.setRotationDeg(numeric);
    }
  }, [resolveSelected, patchEntity]);

  const onToggle = useCallback((_key: string, _next: boolean): void => {
    /* no-op — included for interface parity */
  }, []);
  const getToggleState = useCallback((_key: string): RibbonToggleState => NULL_TOGGLE, []);
  const onAction = useCallback((_action: string): void => {
    /* no-op — the tab auto-hides when neither a symbol is selected nor the tool active */
  }, []);
  const getPanelVisibility = useCallback((_visibilityKey: string): boolean => true, []);

  return useMemo(
    () => ({ onComboboxChange, getComboboxState, onToggle, getToggleState, onAction, getPanelVisibility }),
    [onComboboxChange, getComboboxState, onToggle, getToggleState, onAction, getPanelVisibility],
  );
}

/** Type guard used by `useRibbonCommands` composer (no visibility keys). */
export function isAnnotationSymbolPanelVisibilityKey(_visibilityKey: string): boolean {
  return false;
}

export { isAnnotationSymbolRibbonKey, isAnnotationSymbolRibbonStringKey };
