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

import { useCallback } from 'react';
import { useAnnotationSymbolSelectionStore } from '../../../state/annotation-symbol-selection-store';
import {
  ANNOTATION_SYMBOL_RIBBON_KEYS,
  isAnnotationSymbolRibbonKey,
  isAnnotationSymbolRibbonStringKey,
} from './bridge/annotation-symbol-command-keys';
import type { RibbonComboboxState } from '../context/RibbonCommandContext';
import { listAnnotationSymbolsByKind } from '../../../config/annotation-symbol-catalog';
import type { AnnotationSymbolKind } from '../../../types/annotation-symbol';
import { isAnnotationSymbolEntity } from '../../../types/entities';
import type { LevelSceneWriter } from '../../../systems/levels/level-scene-accessor';
import type { useUniversalSelection } from '../../../systems/selection';
import {
  useInertBridgeExtras,
  useStableBridge,
  useResolveSelectedEntity,
  useUpdateEntityPatch,
  type RibbonEntityBridgeCore,
} from './ribbon-entity-bridge-shared';

type UniversalSelectionLike = Pick<ReturnType<typeof useUniversalSelection>, 'getPrimaryId'>;

export interface UseRibbonAnnotationSymbolBridgeProps {
  readonly levelManager: LevelSceneWriter;
  readonly universalSelection: UniversalSelectionLike;
}

export type RibbonAnnotationSymbolBridge = RibbonEntityBridgeCore;

/** Variant options for a kind, GENERATED from the catalog SSoT (never hand-listed). */
function variantOptionsForKind(kind: AnnotationSymbolKind) {
  return listAnnotationSymbolsByKind(kind).map((d) => ({
    value: d.id,
    labelKey: d.labelKey,
    isLiteralLabel: false,
  }));
}

export function useRibbonAnnotationSymbolBridge(
  props: UseRibbonAnnotationSymbolBridgeProps,
): RibbonAnnotationSymbolBridge {
  const { levelManager, universalSelection } = props;

  // Subscribe so the tool-active picker re-renders when the defaults / kind change.
  const symbolId = useAnnotationSymbolSelectionStore((s) => s.symbolId);
  const sizeMm = useAnnotationSymbolSelectionStore((s) => s.sizeMm);
  const rotationDeg = useAnnotationSymbolSelectionStore((s) => s.rotationDeg);
  const activeKind = useAnnotationSymbolSelectionStore((s) => s.activeKind);

  /** The selected annotation-symbol entity (edit mode), or null (defaults mode). */
  const resolveSelected = useResolveSelectedEntity(levelManager, universalSelection, isAnnotationSymbolEntity);

  const patchEntity = useUpdateEntityPatch(levelManager, 'Update annotation symbol');

  const getComboboxState = useCallback(
    (commandKey: string): RibbonComboboxState | null => {
      const selected = resolveSelected();
      const curSymbolId = selected ? selected.symbolId : symbolId;
      const curSize = selected ? (selected.sizeMm ?? sizeMm) : sizeMm;
      const curRot = selected ? (selected.rotation ?? 0) : rotationDeg;
      // Variant list follows the edited symbol's family (edit) or the active tool's
      // family (placement) — one tab serves every kind (mirror MEP-segment).
      const curKind = selected ? selected.kind : activeKind;
      if (commandKey === ANNOTATION_SYMBOL_RIBBON_KEYS.stringParams.symbolId) {
        return { value: curSymbolId, options: variantOptionsForKind(curKind) };
      }
      if (commandKey === ANNOTATION_SYMBOL_RIBBON_KEYS.params.sizeMm) {
        return { value: String(curSize), options: [] };
      }
      if (commandKey === ANNOTATION_SYMBOL_RIBBON_KEYS.params.rotation) {
        return { value: String(curRot), options: [] };
      }
      return null;
    },
    [resolveSelected, symbolId, sizeMm, rotationDeg, activeKind],
  );

  const onComboboxChange = useCallback((commandKey: string, value: string): void => {
    const selected = resolveSelected();
    const store = useAnnotationSymbolSelectionStore.getState();
    if (commandKey === ANNOTATION_SYMBOL_RIBBON_KEYS.stringParams.symbolId) {
      if (selected) patchEntity(selected.id, { symbolId: value });
      else store.setSymbolId(value);
      return;
    }
    const numeric = Number.parseFloat(value);
    if (Number.isNaN(numeric)) return;
    if (commandKey === ANNOTATION_SYMBOL_RIBBON_KEYS.params.sizeMm) {
      if (numeric <= 0) return;
      if (selected) patchEntity(selected.id, { sizeMm: numeric });
      else store.setSizeMm(numeric);
      return;
    }
    if (commandKey === ANNOTATION_SYMBOL_RIBBON_KEYS.params.rotation) {
      if (selected) patchEntity(selected.id, { rotation: numeric });
      else store.setRotationDeg(numeric);
    }
  }, [resolveSelected, patchEntity]);

  const { onToggle, getToggleState, onAction, getPanelVisibility } = useInertBridgeExtras();

  return useStableBridge({ onComboboxChange, getComboboxState, onToggle, getToggleState, onAction, getPanelVisibility });
}

/** Type guard used by `useRibbonCommands` composer (no visibility keys). */
export function isAnnotationSymbolPanelVisibilityKey(_visibilityKey: string): boolean {
  return false;
}

export { isAnnotationSymbolRibbonKey, isAnnotationSymbolRibbonStringKey };
