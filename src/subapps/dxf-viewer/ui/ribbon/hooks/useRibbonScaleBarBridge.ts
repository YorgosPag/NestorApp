'use client';

/**
 * ADR-583 Φ3e — Bridge between the contextual graphic scale-bar ribbon tab and
 * EITHER (α) a selected `scale-bar` entity or (β) the placement defaults
 * (`scale-bar-options-store`).
 *
 * Dual mode (Revit «διάλεξε στυλ → τοποθέτησε» + «επίλεξε → επεξεργάσου» — mirror
 * του `useRibbonAnnotationSymbolBridge` / `useRibbonHatchBridge`):
 *   - Επιλεγμένη κλίμακα → read/write μέσω του generic `UpdateEntityCommand`
 *     (undoable, μηδέν νέα command class). Αλλάζοντας στυλ/μονάδα/τμήματα/… μεταλλάσσει
 *     το ΙΔΙΟ entity· η DERIVED γεωμετρία (`computeScaleBarGeometry`) ξαναϋπολογίζεται
 *     στο render → live WYSIWYG.
 *   - Καμία επιλογή (εργαλείο `scale-bar` ενεργό) → read/write στο options store
 *     (defaults για την ΕΠΟΜΕΝΗ τοποθέτηση, που διαβάζει το
 *     `buildScaleBarEntityFromLiveOptions`).
 *
 * No-ops for commandKeys outside `SCALE_BAR_RIBBON_KEYS` so it composes with the
 * other bridges in `useRibbonCommands`.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-583-annotation-symbol-library-north-arrow.md
 */

import { useCallback } from 'react';
import { useScaleBarOptionsStore } from '../../../state/scale-bar-options-store';
import {
  SCALE_BAR_RIBBON_KEYS,
  isScaleBarRibbonKey,
  isScaleBarRibbonStringKey,
} from './bridge/scale-bar-command-keys';
import type { RibbonComboboxState } from '../context/RibbonCommandContext';
import type { RibbonBridgeCore } from './bridge/ribbon-bridge-core';
import type {
  ScaleBarStyle,
  ScaleBarLabelPlacement,
} from '../../../types/scale-bar';
import { isScaleBarEntity } from '../../../types/scale-bar';
import type { SceneUnits } from '../../../utils/scene-units';
import type { LevelSceneWriter } from '../../../systems/levels/level-scene-accessor';
import type { useUniversalSelection } from '../../../systems/selection';
import {
  useInertBridgeExtras,
  useStableBridge,
  useResolveSelectedEntity,
  useUpdateEntityPatch,
} from './ribbon-entity-bridge-shared';

type UniversalSelectionLike = Pick<ReturnType<typeof useUniversalSelection>, 'getPrimaryId'>;

export interface UseRibbonScaleBarBridgeProps {
  readonly levelManager: LevelSceneWriter;
  readonly universalSelection: UniversalSelectionLike;
}

export interface RibbonScaleBarBridge extends RibbonBridgeCore {
  readonly getPanelVisibility: (visibilityKey: string) => boolean;
}

export function useRibbonScaleBarBridge(
  props: UseRibbonScaleBarBridgeProps,
): RibbonScaleBarBridge {
  const { levelManager, universalSelection } = props;

  // Subscribe so the tool-active picker re-renders when the placement defaults change.
  const style = useScaleBarOptionsStore((s) => s.style);
  const unit = useScaleBarOptionsStore((s) => s.unit);
  const divisions = useScaleBarOptionsStore((s) => s.divisions);
  const subdivisions = useScaleBarOptionsStore((s) => s.subdivisions);
  const barHeightMm = useScaleBarOptionsStore((s) => s.barHeightMm);
  const labelHeightMm = useScaleBarOptionsStore((s) => s.labelHeightMm);
  const labelPlacement = useScaleBarOptionsStore((s) => s.labelPlacement);

  /** The selected scale-bar entity (edit mode), or null (defaults mode). */
  const resolveSelected = useResolveSelectedEntity(levelManager, universalSelection, isScaleBarEntity);

  const patchEntity = useUpdateEntityPatch(levelManager, 'Edit scale bar');

  const getComboboxState = useCallback(
    (commandKey: string): RibbonComboboxState | null => {
      const s = resolveSelected();
      switch (commandKey) {
        case SCALE_BAR_RIBBON_KEYS.stringParams.style:
          return { value: s ? s.style : style, options: [] };
        case SCALE_BAR_RIBBON_KEYS.stringParams.unit:
          return { value: s ? s.unit : unit, options: [] };
        case SCALE_BAR_RIBBON_KEYS.stringParams.labelPlacement:
          return { value: s ? s.labelPlacement : labelPlacement, options: [] };
        case SCALE_BAR_RIBBON_KEYS.params.divisions:
          return { value: String(s ? s.divisions : divisions), options: [] };
        case SCALE_BAR_RIBBON_KEYS.params.subdivisions:
          return { value: String(s ? s.subdivisions : subdivisions), options: [] };
        case SCALE_BAR_RIBBON_KEYS.params.barHeightMm:
          return { value: String(s ? s.barHeightMm : barHeightMm), options: [] };
        case SCALE_BAR_RIBBON_KEYS.params.labelHeightMm:
          return { value: String(s ? s.labelHeightMm : labelHeightMm), options: [] };
        default:
          return null;
      }
    },
    [resolveSelected, style, unit, labelPlacement, divisions, subdivisions, barHeightMm, labelHeightMm],
  );

  const onComboboxChange = useCallback(
    (commandKey: string, value: string): void => {
      const selected = resolveSelected();
      const store = useScaleBarOptionsStore.getState();
      // ── String params (enum pickers) ────────────────────────────────────────
      if (commandKey === SCALE_BAR_RIBBON_KEYS.stringParams.style) {
        const v = value as ScaleBarStyle;
        if (selected) patchEntity(selected.id, { style: v });
        else store.setStyle(v);
        return;
      }
      if (commandKey === SCALE_BAR_RIBBON_KEYS.stringParams.unit) {
        const v = value as SceneUnits;
        if (selected) patchEntity(selected.id, { unit: v });
        else store.setUnit(v);
        return;
      }
      if (commandKey === SCALE_BAR_RIBBON_KEYS.stringParams.labelPlacement) {
        const v = value as ScaleBarLabelPlacement;
        if (selected) patchEntity(selected.id, { labelPlacement: v });
        else store.setLabelPlacement(v);
        return;
      }
      // ── Numeric params ──────────────────────────────────────────────────────
      const numeric = Number.parseFloat(value);
      if (Number.isNaN(numeric)) return;
      if (commandKey === SCALE_BAR_RIBBON_KEYS.params.divisions) {
        if (numeric < 1) return;
        const n = Math.round(numeric);
        if (selected) patchEntity(selected.id, { divisions: n });
        else store.setDivisions(n);
        return;
      }
      if (commandKey === SCALE_BAR_RIBBON_KEYS.params.subdivisions) {
        if (numeric < 0) return;
        const n = Math.round(numeric);
        if (selected) patchEntity(selected.id, { subdivisions: n });
        else store.setSubdivisions(n);
        return;
      }
      if (commandKey === SCALE_BAR_RIBBON_KEYS.params.barHeightMm) {
        if (numeric <= 0) return;
        if (selected) patchEntity(selected.id, { barHeightMm: numeric });
        else store.setBarHeightMm(numeric);
        return;
      }
      if (commandKey === SCALE_BAR_RIBBON_KEYS.params.labelHeightMm) {
        if (numeric <= 0) return;
        if (selected) patchEntity(selected.id, { labelHeightMm: numeric });
        else store.setLabelHeightMm(numeric);
      }
    },
    [resolveSelected, patchEntity],
  );

  const { onToggle, getToggleState, onAction, getPanelVisibility } = useInertBridgeExtras();

  return useStableBridge({ onComboboxChange, getComboboxState, onToggle, getToggleState, onAction, getPanelVisibility });
}

/** Type guard used by `useRibbonCommands` composer (no visibility keys). */
export function isScaleBarPanelVisibilityKey(_visibilityKey: string): boolean {
  return false;
}

export { isScaleBarRibbonKey, isScaleBarRibbonStringKey };
