'use client';

/**
 * ADR-507 S2 — Bridge μεταξύ του contextual «Γραμμοσκίαση» tab και (α) του
 * επιλεγμένου `HatchEntity` ή (β) των draw-defaults (όταν είναι ενεργό το εργαλείο
 * χωρίς επιλογή).
 *
 * Dual mode (Revit «διάλεξε μοτίβο → σχεδίασε» + «επίλεξε → επεξεργάσου»):
 *   - Επιλεγμένο hatch → read/write μέσω του generic `UpdateEntityCommand`
 *     (undoable, μηδέν νέα command class) + live εμβαδόν από την οντότητα.
 *   - Καμία επιλογή → read/write στο `hatch-draw-defaults-store` (επόμενη hatch).
 *
 * No-ops για commandKeys εκτός `HATCH_RIBBON_KEYS` ώστε να composeί με τα υπόλοιπα
 * bridges στο `useRibbonCommands`. Mirror του `useRibbonFloorFinishBridge`.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-507-hatch-creation-system.md
 */

import { useCallback, useMemo, useSyncExternalStore } from 'react';
import { useTranslation } from 'react-i18next';
import { isHatchEntity } from '../../../types/entities';
import type { HatchEntity, LineweightMm } from '../../../types/entities';
import { isConcreteLineweight, LINEWEIGHT_SPECIAL, parseDxfCode370 } from '../../../config/lineweight-iso-catalog';
import { LINEWEIGHT_BYLAYER_VALUE } from '../data/lineweight-ribbon-options';
import { useCommandHistory } from '../../../core/commands';
import { UpdateEntityCommand } from '../../../core/commands/entity-commands/UpdateEntityCommand';
import { DeleteEntityCommand } from '../../../core/commands/entity-commands/DeleteEntityCommand';
import { LevelSceneManagerAdapter } from '../../../systems/entity-creation/LevelSceneManagerAdapter';
import {
  getHatchDrawDefaults,
  setHatchDrawDefaults,
  subscribeHatchDrawDefaults,
  type HatchDrawDefaults,
} from '../../../bim/hatch/hatch-draw-defaults-store';
// ADR-507 Φ3 — pick-mode SSoT (Τρόπος Α boundary ⇄ Τρόπος Β pick-point).
import {
  getHatchPickMode,
  setHatchPickMode,
  subscribeHatchPickMode,
  type HatchPickMode,
} from '../../../bim/hatch/hatch-pick-mode-store';
import { computeHatchAreaMm2 } from '../../../bim/hatch/hatch-completion';
import {
  buildGradientFromDefaults,
  withGradientPatch,
  type GradientFieldPatch,
} from '../../../bim/hatch/hatch-gradient-build';
import { normalizeGradientType, normalizeGradientShift } from '../../../bim/hatch/hatch-gradient';
import {
  HATCH_RIBBON_KEYS,
  isHatchRibbonNumberKey,
  isHatchRibbonStringKey,
  isHatchRibbonToggleKey,
  isHatchRibbonReadoutKey,
  isHatchRibbonActionKey,
  isHatchRibbonVisibilityKey,
} from './bridge/hatch-command-keys';
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

export interface UseRibbonHatchBridgeProps {
  readonly levelManager: LevelManagerLike;
  readonly universalSelection: UniversalSelectionLike;
}

export interface RibbonHatchBridge {
  readonly onComboboxChange: (commandKey: string, value: string) => void;
  readonly getComboboxState: (commandKey: string) => RibbonComboboxState | null;
  readonly onToggle: (commandKey: string, nextValue: boolean) => void;
  readonly getToggleState: (commandKey: string) => RibbonToggleState;
  readonly onAction: (action: string) => void;
  readonly getPanelVisibility: (visibilityKey: string) => boolean;
}

const NULL_TOGGLE: RibbonToggleState = false;

/** mm² → «12.50 m²» (runtime value, όχι i18n label). */
function formatAreaM2(mm2: number): string {
  return `${(mm2 / 1_000_000).toFixed(2)} m²`;
}

/** Map ενός gradient field patch → το αντίστοιχο flat draw-default πεδίο (no-selection mode). */
function gradientDefaultPatch(patch: GradientFieldPatch): Partial<HatchDrawDefaults> {
  switch (patch.field) {
    case 'type': return { gradientType: patch.value };
    case 'color1': return { gradientColor1: patch.value };
    case 'color2': return { gradientColor2: patch.value };
    case 'singleColor': return { gradientSingleColor: patch.value };
    case 'angleDeg': return { gradientAngle: patch.value };
    case 'shift': return { gradientShift: patch.value };
  }
}

/** lineweightMm → option value ('ByLayer' ή «0.50»· toFixed(2) ταιριάζει με LINEWEIGHT_RIBBON_OPTIONS). */
function lineweightToOptionValue(lw: LineweightMm | undefined): string {
  return isConcreteLineweight(lw) ? lw.toFixed(2) : LINEWEIGHT_BYLAYER_VALUE;
}

export function useRibbonHatchBridge(
  props: UseRibbonHatchBridgeProps,
): RibbonHatchBridge {
  const { levelManager, universalSelection } = props;
  const { execute: executeCommand } = useCommandHistory();
  const { t } = useTranslation('dxf-viewer-shell');

  // Re-render όταν αλλάζουν τα draw-defaults (low-frequency — user edits).
  const defaults = useSyncExternalStore<HatchDrawDefaults>(
    subscribeHatchDrawDefaults,
    getHatchDrawDefaults,
    getHatchDrawDefaults,
  );
  // Re-render όταν αλλάζει η μέθοδος ορίου (pick-point ⇄ boundary).
  const pickMode = useSyncExternalStore<HatchPickMode>(
    subscribeHatchPickMode,
    getHatchPickMode,
    getHatchPickMode,
  );

  const resolveHatch = useCallback((): HatchEntity | null => {
    const id = universalSelection.getPrimaryId();
    if (!id || !levelManager.currentLevelId) return null;
    const scene = levelManager.getLevelScene(levelManager.currentLevelId);
    if (!scene) return null;
    const e = scene.entities.find((x) => x.id === id);
    if (!e || !isHatchEntity(e)) return null;
    return e;
  }, [levelManager, universalSelection]);

  const patchHatch = useCallback(
    (hatch: HatchEntity, patch: Record<string, unknown>): void => {
      if (!levelManager.currentLevelId) return;
      const sm = new LevelSceneManagerAdapter(
        levelManager.getLevelScene,
        levelManager.setLevelScene,
        levelManager.currentLevelId,
      );
      executeCommand(new UpdateEntityCommand(hatch.id, patch, sm, 'Update hatch'));
    },
    [executeCommand, levelManager],
  );

  // Gradient = nested object: σε αλλαγή 1 πεδίου ξαναχτίζουμε ΟΛΟ το gradient
  // (immutable) από (entity.gradient ?? defaults) + patch, μέσω του build SSoT.
  const applyGradientChange = useCallback(
    (hatch: HatchEntity | null, patch: GradientFieldPatch): void => {
      if (hatch) {
        const gradient = withGradientPatch(hatch.gradient, defaults, patch);
        patchHatch(hatch, { gradient, fillType: 'gradient', patternType: 'gradient' });
      } else {
        setHatchDrawDefaults(gradientDefaultPatch(patch));
      }
    },
    [defaults, patchHatch],
  );

  const getComboboxState = useCallback(
    (commandKey: string): RibbonComboboxState | null => {
      const hatch = resolveHatch();
      // Readout: live εμβαδόν (μόνο όταν υπάρχει επιλεγμένη γραμμοσκίαση).
      if (isHatchRibbonReadoutKey(commandKey)) {
        return { value: hatch ? formatAreaM2(computeHatchAreaMm2(hatch)) : '—', options: [] };
      }
      if (isHatchRibbonStringKey(commandKey)) {
        if (commandKey === HATCH_RIBBON_KEYS.stringParams.fillType) {
          return { value: hatch?.fillType ?? defaults.fillType, options: [] };
        }
        if (commandKey === HATCH_RIBBON_KEYS.stringParams.fillColor) {
          return { value: hatch?.fillColor ?? defaults.fillColor, options: [] };
        }
        if (commandKey === HATCH_RIBBON_KEYS.stringParams.patternName) {
          return { value: hatch?.patternName ?? defaults.patternName, options: [] };
        }
        if (commandKey === HATCH_RIBBON_KEYS.stringParams.lineweight) {
          return { value: lineweightToOptionValue(hatch?.lineweightMm ?? defaults.lineweightMm), options: [] };
        }
        if (commandKey === HATCH_RIBBON_KEYS.stringParams.gradientType) {
          return { value: hatch?.gradient?.type ?? defaults.gradientType, options: [] };
        }
        if (commandKey === HATCH_RIBBON_KEYS.stringParams.gradientColor1) {
          return { value: hatch?.gradient?.color1 ?? defaults.gradientColor1, options: [] };
        }
        if (commandKey === HATCH_RIBBON_KEYS.stringParams.gradientColor2) {
          return { value: hatch?.gradient?.color2 ?? defaults.gradientColor2, options: [] };
        }
        // Μέθοδος ορίου = tool setting (όχι ιδιότητα οντότητας) → πάντα από το store.
        if (commandKey === HATCH_RIBBON_KEYS.stringParams.method) {
          return { value: pickMode, options: [] };
        }
        return { value: hatch?.islandStyle ?? defaults.islandStyle, options: [] };
      }
      if (isHatchRibbonNumberKey(commandKey)) {
        if (commandKey === HATCH_RIBBON_KEYS.params.gapTolerance) {
          return { value: String(hatch?.gapTolerance ?? defaults.gapTolerance), options: [] };
        }
        if (commandKey === HATCH_RIBBON_KEYS.params.lineAngle) {
          return { value: String(hatch?.lineAngle ?? defaults.lineAngle), options: [] };
        }
        if (commandKey === HATCH_RIBBON_KEYS.params.patternScale) {
          return { value: String(hatch?.patternScale ?? defaults.patternScale), options: [] };
        }
        if (commandKey === HATCH_RIBBON_KEYS.params.gradientAngle) {
          return { value: String(hatch?.gradient?.angleDeg ?? defaults.gradientAngle), options: [] };
        }
        if (commandKey === HATCH_RIBBON_KEYS.params.gradientShift) {
          return { value: String(hatch?.gradient?.shift ?? defaults.gradientShift), options: [] };
        }
        return { value: String(hatch?.lineSpacing ?? defaults.lineSpacing), options: [] };
      }
      return null;
    },
    [resolveHatch, defaults, pickMode],
  );

  const onComboboxChange = useCallback(
    (commandKey: string, value: string): void => {
      const hatch = resolveHatch();
      if (isHatchRibbonStringKey(commandKey)) {
        if (commandKey === HATCH_RIBBON_KEYS.stringParams.fillType) {
          const fillType: NonNullable<HatchEntity['fillType']> =
            value === 'user-defined' ? 'user-defined'
              : value === 'predefined' ? 'predefined'
                : value === 'gradient' ? 'gradient'
                  : 'solid';
          const patternType: NonNullable<HatchEntity['patternType']> =
            fillType === 'solid' ? 'solid' : fillType === 'gradient' ? 'gradient' : 'pattern';
          if (hatch) {
            // Switch χωρίς δεδομένα → δώσε τα defaults ώστε να φανεί αμέσως (mirror predefined).
            const patch: Record<string, unknown> = { fillType, patternType };
            if (fillType === 'predefined' && !hatch.patternName) patch.patternName = defaults.patternName;
            if (fillType === 'gradient' && !hatch.gradient) patch.gradient = buildGradientFromDefaults(defaults);
            patchHatch(hatch, patch);
          } else setHatchDrawDefaults({ fillType });
          return;
        }
        if (commandKey === HATCH_RIBBON_KEYS.stringParams.fillColor) {
          if (hatch) patchHatch(hatch, { fillColor: value });
          else setHatchDrawDefaults({ fillColor: value });
          return;
        }
        if (commandKey === HATCH_RIBBON_KEYS.stringParams.patternName) {
          // Επιλογή μοτίβου → αυτόματα predefined (AutoCAD/Revit: διάλεξες μοτίβο =
          // μοτιβωτή γραμμοσκίαση)· αλλιώς το fillType έμενε 'solid' και ο renderer
          // αγνοούσε το patternName (έκανε solid fill).
          if (hatch) patchHatch(hatch, { patternName: value, fillType: 'predefined', patternType: 'pattern' });
          else setHatchDrawDefaults({ patternName: value, fillType: 'predefined' });
          return;
        }
        if (commandKey === HATCH_RIBBON_KEYS.stringParams.lineweight) {
          const lineweightMm: LineweightMm =
            value === LINEWEIGHT_BYLAYER_VALUE
              ? LINEWEIGHT_SPECIAL.BYLAYER
              : parseDxfCode370(Math.round(Number.parseFloat(value) * 100));
          if (hatch) patchHatch(hatch, { lineweightMm });
          else setHatchDrawDefaults({ lineweightMm });
          return;
        }
        if (commandKey === HATCH_RIBBON_KEYS.stringParams.gradientType) {
          applyGradientChange(hatch, { field: 'type', value: normalizeGradientType(value) });
          return;
        }
        if (commandKey === HATCH_RIBBON_KEYS.stringParams.gradientColor1) {
          applyGradientChange(hatch, { field: 'color1', value });
          return;
        }
        if (commandKey === HATCH_RIBBON_KEYS.stringParams.gradientColor2) {
          applyGradientChange(hatch, { field: 'color2', value });
          return;
        }
        // Μέθοδος ορίου (pick-point ⇄ boundary) — καθαρό tool setting.
        if (commandKey === HATCH_RIBBON_KEYS.stringParams.method) {
          setHatchPickMode(value === 'boundary' ? 'boundary' : 'pick-point');
          return;
        }
        // islandStyle
        const islandStyle = value === 'outer' ? 'outer' : value === 'ignore' ? 'ignore' : 'normal';
        if (hatch) patchHatch(hatch, { islandStyle });
        else setHatchDrawDefaults({ islandStyle });
        return;
      }
      if (isHatchRibbonNumberKey(commandKey)) {
        const numeric = Number.parseFloat(value);
        if (Number.isNaN(numeric)) return;
        // Gap tolerance: 0 ΕΓΚΥΡΟ (απενεργοποίηση) → πριν από τον generic >0 έλεγχο.
        if (commandKey === HATCH_RIBBON_KEYS.params.gapTolerance) {
          if (numeric < 0) return;
          if (hatch) patchHatch(hatch, { gapTolerance: numeric > 0 ? numeric : undefined });
          else setHatchDrawDefaults({ gapTolerance: numeric });
          return;
        }
        if (commandKey === HATCH_RIBBON_KEYS.params.gradientAngle) {
          applyGradientChange(hatch, { field: 'angleDeg', value: numeric });
          return;
        }
        if (commandKey === HATCH_RIBBON_KEYS.params.gradientShift) {
          applyGradientChange(hatch, { field: 'shift', value: normalizeGradientShift(numeric) });
          return;
        }
        if (commandKey === HATCH_RIBBON_KEYS.params.lineAngle) {
          if (hatch) patchHatch(hatch, { lineAngle: numeric });
          else setHatchDrawDefaults({ lineAngle: numeric });
          return;
        }
        if (commandKey === HATCH_RIBBON_KEYS.params.patternScale) {
          if (numeric <= 0) return;
          if (hatch) patchHatch(hatch, { patternScale: numeric });
          else setHatchDrawDefaults({ patternScale: numeric });
          return;
        }
        if (numeric <= 0) return;
        if (hatch) patchHatch(hatch, { lineSpacing: numeric });
        else setHatchDrawDefaults({ lineSpacing: numeric });
      }
    },
    [resolveHatch, patchHatch, applyGradientChange, defaults],
  );

  const onToggle = useCallback(
    (commandKey: string, nextValue: boolean): void => {
      if (!isHatchRibbonToggleKey(commandKey)) return;
      const hatch = resolveHatch();
      if (commandKey === HATCH_RIBBON_KEYS.toggles.gradientSingleColor) {
        applyGradientChange(hatch, { field: 'singleColor', value: nextValue });
        return;
      }
      if (hatch) patchHatch(hatch, { doubleCrossHatch: nextValue || undefined });
      else setHatchDrawDefaults({ doubleCrossHatch: nextValue });
    },
    [resolveHatch, patchHatch, applyGradientChange],
  );

  const getToggleState = useCallback(
    (commandKey: string): RibbonToggleState => {
      if (!isHatchRibbonToggleKey(commandKey)) return NULL_TOGGLE;
      const hatch = resolveHatch();
      if (commandKey === HATCH_RIBBON_KEYS.toggles.gradientSingleColor) {
        return hatch ? (hatch.gradient?.singleColor ?? false) : defaults.gradientSingleColor;
      }
      return hatch ? (hatch.doubleCrossHatch ?? false) : defaults.doubleCrossHatch;
    },
    [resolveHatch, defaults],
  );

  const onAction = useCallback(
    (action: string): void => {
      if (!isHatchRibbonActionKey(action)) return;
      if (action === HATCH_RIBBON_KEYS.actions.delete) {
        const hatch = resolveHatch();
        if (!hatch || !levelManager.currentLevelId) return;
        const confirmed = window.confirm(t('ribbon.commands.hatchEditor.deleteConfirm'));
        if (!confirmed) return;
        const sm = new LevelSceneManagerAdapter(
          levelManager.getLevelScene,
          levelManager.setLevelScene,
          levelManager.currentLevelId,
        );
        executeCommand(new DeleteEntityCommand(hatch.id, sm));
        return;
      }
      // ADR-363 — «Κλείσιμο» handled centrally in `routeRibbonAction`
      // (uniform deselect for every contextual tab). No per-bridge branch.
    },
    [resolveHatch, levelManager, executeCommand, t],
  );

  // Gradient panel ορατό μόνο όταν το (επιλεγμένο hatch ή τα defaults) fillType='gradient'.
  const getPanelVisibility = useCallback(
    (visibilityKey: string): boolean => {
      if (!isHatchRibbonVisibilityKey(visibilityKey)) return true;
      const hatch = resolveHatch();
      return (hatch?.fillType ?? defaults.fillType) === 'gradient';
    },
    [resolveHatch, defaults],
  );

  return useMemo(
    () => ({ onComboboxChange, getComboboxState, onToggle, getToggleState, onAction, getPanelVisibility }),
    [onComboboxChange, getComboboxState, onToggle, getToggleState, onAction, getPanelVisibility],
  );
}

/** Type guard — exposed ώστε ο `routeRibbonAction` να δρομολογεί hatch action keys. */
export function isHatchActionKey(action: string): boolean {
  return isHatchRibbonActionKey(action);
}

/** Re-export ώστε ο `useRibbonCommands` να δρομολογεί το hatch gradient panel visibility. */
export { isHatchRibbonVisibilityKey as isHatchPanelVisibilityKey } from './bridge/hatch-command-keys';
