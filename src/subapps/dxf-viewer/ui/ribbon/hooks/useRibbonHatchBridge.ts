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

import { useCallback, useSyncExternalStore } from 'react';
import { useTranslation } from 'react-i18next';
import { isHatchEntity } from '../../../types/entities';
import type { HatchEntity, LineweightMm } from '../../../types/entities';
import { isConcreteLineweight, LINEWEIGHT_SPECIAL, parseDxfCode370 } from '../../../config/lineweight-iso-catalog';
import { LINEWEIGHT_BYLAYER_VALUE } from '../data/lineweight-ribbon-options';
import { useCommandHistory, CompoundCommand } from '../../../core/commands';
import { UpdateEntityCommand } from '../../../core/commands/entity-commands/UpdateEntityCommand';
import { DeleteEntityCommand } from '../../../core/commands/entity-commands/DeleteEntityCommand';
// ADR-507 «Πίσω πλάνο» — array-order = paint-order reorder (κοινό, undoable).
import { ReorderEntityCommand } from '../../../core/commands/entity-commands/ReorderEntityCommand';
import { createLevelSceneManagerAdapter } from '../../../systems/entity-creation/LevelSceneManagerAdapter';
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
// ADR-507 — mode-aware «Απόσταση» στο «έτοιμο μοτίβο»: world min-spacing ⇄ patternScale (SSoT).
import {
  hatchMinWorldSpacing,
  patternScaleForSpacingMm,
} from '../../../bim/geometry/shared/hatch-pattern-geometry';
// Area readout SSoT (ADR-462) — locale + display-unit aware (μηδέν δικό μου format).
import { formatAreaForDisplay } from '../../../config/display-length-format';
// ADR-507 — «Επιλογή γραμμοσκίασης» (armed pick-existing) mode SSoT.
import {
  armHatchSelect,
  disarmHatchSelect,
  isHatchSelectArmed,
  subscribeHatchSelect,
} from '../../../bim/hatch/hatch-select-mode-store';
import { toolHintOverrideStore } from '../../../hooks/toolHintOverrideStore';
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
import type { LevelSceneWriter } from '../../../systems/levels/level-scene-accessor';
import type { useUniversalSelection } from '../../../systems/selection';
import {
  useResolveSelectedEntity,
  useStableBridge,
  entityTransparencyValue,
  clampTransparency,
  type RibbonEntityBridgeCore,
} from './ribbon-entity-bridge-shared';

type UniversalSelectionLike = Pick<
  ReturnType<typeof useUniversalSelection>,
  'getPrimaryId'
>;

export interface UseRibbonHatchBridgeProps {
  readonly levelManager: LevelSceneWriter;
  readonly universalSelection: UniversalSelectionLike;
}

export type RibbonHatchBridge = RibbonEntityBridgeCore;

const NULL_TOGGLE: RibbonToggleState = false;

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
  // Re-render όταν αλλάζει το armed «Επιλογή γραμμοσκίασης» (toggle κουμπί = πατημένο).
  const hatchSelectArmed = useSyncExternalStore<boolean>(
    subscribeHatchSelect,
    isHatchSelectArmed,
    isHatchSelectArmed,
  );

  const resolveHatch = useResolveSelectedEntity(levelManager, universalSelection, isHatchEntity);

  const patchHatch = useCallback(
    (hatch: HatchEntity, patch: Record<string, unknown>): void => {
      if (!levelManager.currentLevelId) return;
      const sm = createLevelSceneManagerAdapter(
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
        return { value: hatch ? formatAreaForDisplay(computeHatchAreaMm2(hatch)) : '—', options: [] };
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
        return { value: hatch?.islandStyle ?? defaults.islandStyle, options: [] };
      }
      if (isHatchRibbonNumberKey(commandKey)) {
        // Διαφάνεια: ιδιότητα ΜΟΝΟ επιλεγμένης γραμμοσκίασης (mirror line-tool· χωρίς draw-default).
        if (commandKey === HATCH_RIBBON_KEYS.params.transparency) {
          return { value: hatch ? entityTransparencyValue(hatch) : '0', options: [] };
        }
        if (commandKey === HATCH_RIBBON_KEYS.params.gapTolerance) {
          return { value: String(hatch?.gapTolerance ?? defaults.gapTolerance), options: [] };
        }
        if (commandKey === HATCH_RIBBON_KEYS.params.lineAngle) {
          // «Γωνία»: στο «έτοιμο μοτίβο» οδηγεί το patternAngle (ο predefined renderer
          // αγνοεί το lineAngle)· αλλιώς το lineAngle (user-defined).
          const isPredef = (hatch?.fillType ?? defaults.fillType) === 'predefined';
          const angle = isPredef
            ? (hatch?.patternAngle ?? defaults.patternAngle)
            : (hatch?.lineAngle ?? defaults.lineAngle);
          return { value: String(angle), options: [] };
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
        // «Απόσταση»: στο «έτοιμο μοτίβο» δείχνει την ΠΡΑΓΜΑΤΙΚΗ world απόσταση γραμμών
        // (min-spacing), που προκύπτει από το patternScale· αλλιώς το lineSpacing (mm).
        const isPredef = (hatch?.fillType ?? defaults.fillType) === 'predefined';
        if (isPredef) {
          const worldSpacing = hatchMinWorldSpacing(
            hatch ?? { fillType: 'predefined', patternName: defaults.patternName, patternScale: defaults.patternScale },
          );
          return { value: String(Math.round(worldSpacing)), options: [] };
        }
        return { value: String(hatch?.lineSpacing ?? defaults.lineSpacing), options: [] };
      }
      return null;
    },
    [resolveHatch, defaults],
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
        // islandStyle
        const islandStyle = value === 'outer' ? 'outer' : value === 'ignore' ? 'ignore' : 'normal';
        if (hatch) patchHatch(hatch, { islandStyle });
        else setHatchDrawDefaults({ islandStyle });
        return;
      }
      if (isHatchRibbonNumberKey(commandKey)) {
        const numeric = Number.parseFloat(value);
        if (Number.isNaN(numeric)) return;
        // Διαφάνεια: 0 ΕΓΚΥΡΟ (αδιαφανές) → πριν τον generic >0 έλεγχο. Selected-only.
        if (commandKey === HATCH_RIBBON_KEYS.params.transparency) {
          if (numeric < 0 || !hatch) return;
          patchHatch(hatch, { transparency: clampTransparency(numeric) });
          return;
        }
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
          // «Γωνία»: predefined → patternAngle (ο renderer αγνοεί το lineAngle στο μοτίβο)·
          // αλλιώς → lineAngle (user-defined).
          const isPredef = (hatch?.fillType ?? defaults.fillType) === 'predefined';
          const patch = isPredef ? { patternAngle: numeric } : { lineAngle: numeric };
          if (hatch) patchHatch(hatch, patch);
          else setHatchDrawDefaults(patch);
          return;
        }
        if (commandKey === HATCH_RIBBON_KEYS.params.patternScale) {
          if (numeric <= 0) return;
          if (hatch) patchHatch(hatch, { patternScale: numeric });
          else setHatchDrawDefaults({ patternScale: numeric });
          return;
        }
        if (numeric <= 0) return;
        // «Απόσταση»: predefined → μεταφράζεται σε patternScale ώστε οι γραμμές του μοτίβου
        // να απέχουν ~numeric mm (SSoT conversion)· αλλιώς → lineSpacing (user-defined mm).
        const isPredef = (hatch?.fillType ?? defaults.fillType) === 'predefined';
        if (isPredef) {
          const patternScale = patternScaleForSpacingMm(hatch?.patternName ?? defaults.patternName, numeric);
          if (hatch) patchHatch(hatch, { patternScale });
          else setHatchDrawDefaults({ patternScale });
          return;
        }
        if (hatch) patchHatch(hatch, { lineSpacing: numeric });
        else setHatchDrawDefaults({ lineSpacing: numeric });
      }
    },
    [resolveHatch, patchHatch, applyGradientChange, defaults],
  );

  const onToggle = useCallback(
    (commandKey: string, nextValue: boolean): void => {
      if (!isHatchRibbonToggleKey(commandKey)) return;
      // ADR-507 Φ3 — Μέθοδος ορίου ως radio-toggles: το κουμπί ΠΑΝΤΑ επιλέγει το mode
      // του (αγνοεί το nextValue — ένα από τα δύο μένει πάντα ενεργό). SSoT = pick-mode store.
      if (commandKey === HATCH_RIBBON_KEYS.toggles.methodPickPoint) {
        setHatchPickMode('pick-point');
        return;
      }
      if (commandKey === HATCH_RIBBON_KEYS.toggles.methodBoundary) {
        setHatchPickMode('boundary');
        return;
      }
      // «Επιλογή γραμμοσκίασης» — armed pick-existing (όχι ιδιότητα οντότητας). Όσο
      // πατημένο, το επόμενο κλικ στον καμβά επιλέγει hatch-only (mouse-handler-up).
      if (commandKey === HATCH_RIBBON_KEYS.toggles.selectExisting) {
        if (nextValue) {
          armHatchSelect();
          toolHintOverrideStore.setOverride(t('ribbon.commands.hatchEditor.selectExistingHint'));
        } else {
          disarmHatchSelect();
        }
        return;
      }
      const hatch = resolveHatch();
      // «Πίσω πλάνο»: ON → στο πίσω μέρος του entities array (ζωγραφίζεται ΚΑΤΩ)· OFF → μπροστά.
      // drawOrder = αποθηκευμένο intent, ReorderEntityCommand = η ενέργεια· ΕΝΑ compound = 1 undo.
      if (commandKey === HATCH_RIBBON_KEYS.toggles.sendToBack) {
        if (!hatch || !levelManager.currentLevelId) return;
        const sm = createLevelSceneManagerAdapter(
          levelManager.getLevelScene,
          levelManager.setLevelScene,
          levelManager.currentLevelId,
        );
        executeCommand(new CompoundCommand('Hatch draw order', [
          new ReorderEntityCommand(hatch.id, nextValue ? 'back' : 'front', sm),
          new UpdateEntityCommand(hatch.id, { drawOrder: nextValue ? 0 : 4 }, sm, 'Update hatch'),
        ]));
        return;
      }
      if (commandKey === HATCH_RIBBON_KEYS.toggles.gradientSingleColor) {
        applyGradientChange(hatch, { field: 'singleColor', value: nextValue });
        return;
      }
      if (hatch) patchHatch(hatch, { doubleCrossHatch: nextValue || undefined });
      else setHatchDrawDefaults({ doubleCrossHatch: nextValue });
    },
    [resolveHatch, patchHatch, applyGradientChange, executeCommand, levelManager, t],
  );

  const getToggleState = useCallback(
    (commandKey: string): RibbonToggleState => {
      if (!isHatchRibbonToggleKey(commandKey)) return NULL_TOGGLE;
      // ADR-507 Φ3 — Μέθοδος ορίου: pressed = το mode του κουμπιού είναι το ενεργό.
      if (commandKey === HATCH_RIBBON_KEYS.toggles.methodPickPoint) {
        return pickMode === 'pick-point';
      }
      if (commandKey === HATCH_RIBBON_KEYS.toggles.methodBoundary) {
        return pickMode === 'boundary';
      }
      // Armed state (πατημένο όσο περιμένουμε κλικ σε γραμμοσκίαση).
      if (commandKey === HATCH_RIBBON_KEYS.toggles.selectExisting) {
        return hatchSelectArmed;
      }
      const hatch = resolveHatch();
      // «Πίσω πλάνο» πατημένο = drawOrder στο back bucket (0). Νέες γραμμοσκιάσεις = 0 → ON.
      if (commandKey === HATCH_RIBBON_KEYS.toggles.sendToBack) {
        return hatch ? (hatch.drawOrder ?? 0) === 0 : NULL_TOGGLE;
      }
      if (commandKey === HATCH_RIBBON_KEYS.toggles.gradientSingleColor) {
        return hatch ? (hatch.gradient?.singleColor ?? false) : defaults.gradientSingleColor;
      }
      return hatch ? (hatch.doubleCrossHatch ?? false) : defaults.doubleCrossHatch;
    },
    [resolveHatch, defaults, hatchSelectArmed, pickMode],
  );

  const onAction = useCallback(
    (action: string): void => {
      if (!isHatchRibbonActionKey(action)) return;
      if (action === HATCH_RIBBON_KEYS.actions.delete) {
        const hatch = resolveHatch();
        if (!hatch || !levelManager.currentLevelId) return;
        const confirmed = window.confirm(t('ribbon.commands.hatchEditor.deleteConfirm'));
        if (!confirmed) return;
        const sm = createLevelSceneManagerAdapter(
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

  return useStableBridge({ onComboboxChange, getComboboxState, onToggle, getToggleState, onAction, getPanelVisibility });
}

/** Type guard — exposed ώστε ο `routeRibbonAction` να δρομολογεί hatch action keys. */
export function isHatchActionKey(action: string): boolean {
  return isHatchRibbonActionKey(action);
}

/** Re-export ώστε ο `useRibbonCommands` να δρομολογεί το hatch gradient panel visibility. */
export { isHatchRibbonVisibilityKey as isHatchPanelVisibilityKey } from './bridge/hatch-command-keys';
