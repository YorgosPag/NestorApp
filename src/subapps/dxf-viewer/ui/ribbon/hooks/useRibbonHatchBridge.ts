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
import { LINEWEIGHT_SPECIAL, parseDxfCode370 } from '../../../config/lineweight-iso-catalog';
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
// ADR-507 — mode-aware «Απόσταση» στο «έτοιμο μοτίβο»: patternScale ⇄ spacing (write-side).
import { patternScaleForSpacingMm } from '../../../bim/geometry/shared/hatch-pattern-geometry';
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
// ADR-643 Φ3 — image-fill build SSoT (mirror του gradient-build).
import {
  buildImageFillFromDefaults,
  withImageFillPatch,
  type ImageFieldPatch,
} from '../../../bim/hatch/hatch-image-build';
// ADR-653 Φ9 — procedural υλικό (assetId `proc:*`) → panel visibility διάκριση.
import { isProceduralAssetId } from '../../../data/procedural-material-catalog';
// ADR-507/510 Φ4 — κοινό «Επίπεδο» field wiring (ίδιο SSoT με το line bridge).
import { useEntityLayerField } from './bridge/useEntityLayerField';
// ADR-643 Φ3 — read-side SSoT (εξήχθη· single-responsibility + όριο 500 γρ.).
import { readHatchComboboxState } from './bridge/hatch-bridge-read';
// ADR-653 — no-selection write-side mappers + image string-field map (εξήχθησαν· όριο 500 γρ.).
import {
  gradientDefaultPatch,
  imageDefaultPatch,
  IMAGE_STRING_FIELDS,
} from './bridge/hatch-bridge-default-patch';
import {
  HATCH_RIBBON_KEYS,
  isHatchRibbonNumberKey,
  isHatchRibbonStringKey,
  isHatchRibbonToggleKey,
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
  // ADR-510 Φ4 — «Επίπεδο»: per-object layerId (επιλεγμένο) / current layer (defaults).
  const layerField = useEntityLayerField(levelManager);

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

  // Image fill = nested object (mirror gradient): σε αλλαγή 1 πεδίου ξαναχτίζουμε ΟΛΟ
  // το imageFill (immutable) από (entity.imageFill ?? defaults) + patch, μέσω του build SSoT.
  const applyImageChange = useCallback(
    (hatch: HatchEntity | null, patch: ImageFieldPatch): void => {
      if (hatch) {
        const imageFill = withImageFillPatch(hatch.imageFill, defaults, patch);
        patchHatch(hatch, { imageFill, fillType: 'image', patternType: 'pattern' });
      } else {
        setHatchDrawDefaults(imageDefaultPatch(defaults, patch));
      }
    },
    [defaults, patchHatch],
  );

  // Read-side εξήχθη ολόκληρο στο `hatch-bridge-read` (pure· single-responsibility +
  // όριο 500 γρ.). Εδώ μένει μόνο η resolve-and-delegate.
  const getComboboxState = useCallback(
    (commandKey: string): RibbonComboboxState | null =>
      readHatchComboboxState(commandKey, resolveHatch(), defaults, layerField),
    [resolveHatch, defaults, layerField],
  );

  const onComboboxChange = useCallback(
    (commandKey: string, value: string): void => {
      const hatch = resolveHatch();
      if (isHatchRibbonStringKey(commandKey)) {
        if (commandKey === HATCH_RIBBON_KEYS.stringParams.layer) {
          layerField.apply(hatch, value);
          return;
        }
        if (commandKey === HATCH_RIBBON_KEYS.stringParams.fillType) {
          const fillType: NonNullable<HatchEntity['fillType']> =
            value === 'user-defined' ? 'user-defined'
              : value === 'predefined' ? 'predefined'
                : value === 'gradient' ? 'gradient'
                  : value === 'image' ? 'image'
                    : 'solid';
          const patternType: NonNullable<HatchEntity['patternType']> =
            fillType === 'solid' ? 'solid' : fillType === 'gradient' ? 'gradient' : 'pattern';
          if (hatch) {
            // Switch χωρίς δεδομένα → δώσε τα defaults ώστε να φανεί αμέσως (mirror predefined).
            const patch: Record<string, unknown> = { fillType, patternType };
            if (fillType === 'predefined' && !hatch.patternName) patch.patternName = defaults.patternName;
            if (fillType === 'gradient' && !hatch.gradient) patch.gradient = buildGradientFromDefaults(defaults);
            if (fillType === 'image' && !hatch.imageFill) patch.imageFill = buildImageFillFromDefaults(defaults);
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
        // Image asset/χρώματα (asset/grout/tint/procedural) — ίδιο μονοπάτι, table-driven.
        const imageStringField = IMAGE_STRING_FIELDS[commandKey];
        if (imageStringField) {
          applyImageChange(hatch, { field: imageStringField, value } as ImageFieldPatch);
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
        // Image tile διαστάσεις (mm, >0) + γωνία (0..360· 0 ΕΓΚΥΡΟ → πριν τον generic >0 έλεγχο).
        if (commandKey === HATCH_RIBBON_KEYS.params.imageTileWidth) {
          if (numeric <= 0) return;
          applyImageChange(hatch, { field: 'tileWidth', value: numeric });
          return;
        }
        if (commandKey === HATCH_RIBBON_KEYS.params.imageTileHeight) {
          if (numeric <= 0) return;
          applyImageChange(hatch, { field: 'tileHeight', value: numeric });
          return;
        }
        if (commandKey === HATCH_RIBBON_KEYS.params.imageAngle) {
          if (numeric < 0) return;
          applyImageChange(hatch, { field: 'angle', value: numeric });
          return;
        }
        if (commandKey === HATCH_RIBBON_KEYS.params.groutWidth) {
          if (numeric <= 0) return;
          applyImageChange(hatch, { field: 'groutWidth', value: numeric });
          return;
        }
        // Ένταση duotone: UI σε % (0..100· 0 ΕΓΚΥΡΟ → πριν τον generic >0 έλεγχο)· domain 0..1.
        if (commandKey === HATCH_RIBBON_KEYS.params.tintStrength) {
          if (numeric < 0) return;
          applyImageChange(hatch, { field: 'tintStrength', value: Math.min(numeric, 100) / 100 });
          return;
        }
        // Αρμός procedural (mm): 0 ΕΓΚΥΡΟ (χωρίς αρμό) → πριν τον generic >0 έλεγχο.
        if (commandKey === HATCH_RIBBON_KEYS.params.procJointMm) {
          if (numeric < 0) return;
          applyImageChange(hatch, { field: 'procJointMm', value: numeric });
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
    [resolveHatch, patchHatch, applyGradientChange, applyImageChange, defaults, layerField],
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
      if (commandKey === HATCH_RIBBON_KEYS.toggles.grout) {
        applyImageChange(hatch, { field: 'groutEnabled', value: nextValue });
        return;
      }
      if (commandKey === HATCH_RIBBON_KEYS.toggles.tint) {
        applyImageChange(hatch, { field: 'tintEnabled', value: nextValue });
        return;
      }
      if (hatch) patchHatch(hatch, { doubleCrossHatch: nextValue || undefined });
      else setHatchDrawDefaults({ doubleCrossHatch: nextValue });
    },
    [resolveHatch, patchHatch, applyGradientChange, applyImageChange, executeCommand, levelManager, t],
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
      if (commandKey === HATCH_RIBBON_KEYS.toggles.grout) {
        return hatch ? !!hatch.imageFill?.grout : defaults.groutEnabled;
      }
      if (commandKey === HATCH_RIBBON_KEYS.toggles.tint) {
        return hatch ? !!hatch.imageFill?.tint : defaults.tintEnabled;
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

  // Contextual panels (Revit-style): κάθε panel ορατό μόνο όταν το (επιλεγμένο hatch ή
  // τα defaults) fillType ταιριάζει — gradient panel ↔ 'gradient', image panel ↔ 'image'.
  const getPanelVisibility = useCallback(
    (visibilityKey: string): boolean => {
      if (!isHatchRibbonVisibilityKey(visibilityKey)) return true;
      const hatch = resolveHatch();
      const fillType = hatch?.fillType ?? defaults.fillType;
      const isImage = fillType === 'image';
      // ADR-653 Φ9 — procedural διακρίνεται από το assetId (`proc:*`).
      const isProc = isImage && isProceduralAssetId(hatch?.imageFill?.assetId ?? defaults.imageAssetId);
      if (visibilityKey === HATCH_RIBBON_KEYS.visibility.image) return isImage;
      // «Χρωματισμός» (duotone) μόνο σε raster υλικά· «Διαδικαστικό» μόνο σε procedural.
      if (visibilityKey === HATCH_RIBBON_KEYS.visibility.imageTint) return isImage && !isProc;
      if (visibilityKey === HATCH_RIBBON_KEYS.visibility.procedural) return isProc;
      return fillType === 'gradient';
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
