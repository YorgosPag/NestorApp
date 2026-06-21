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
import { EventBus } from '../../../systems/events/EventBus';
import {
  getHatchDrawDefaults,
  setHatchDrawDefaults,
  subscribeHatchDrawDefaults,
  type HatchDrawDefaults,
} from '../../../bim/hatch/hatch-draw-defaults-store';
import { computeHatchAreaMm2 } from '../../../bim/hatch/hatch-completion';
import {
  HATCH_RIBBON_KEYS,
  isHatchRibbonNumberKey,
  isHatchRibbonStringKey,
  isHatchRibbonToggleKey,
  isHatchRibbonReadoutKey,
  isHatchRibbonActionKey,
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
}

const NULL_TOGGLE: RibbonToggleState = false;

/** mm² → «12.50 m²» (runtime value, όχι i18n label). */
function formatAreaM2(mm2: number): string {
  return `${(mm2 / 1_000_000).toFixed(2)} m²`;
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
        return { value: hatch?.islandStyle ?? defaults.islandStyle, options: [] };
      }
      if (isHatchRibbonNumberKey(commandKey)) {
        if (commandKey === HATCH_RIBBON_KEYS.params.lineAngle) {
          return { value: String(hatch?.lineAngle ?? defaults.lineAngle), options: [] };
        }
        if (commandKey === HATCH_RIBBON_KEYS.params.patternScale) {
          return { value: String(hatch?.patternScale ?? defaults.patternScale), options: [] };
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
          const fillType =
            value === 'user-defined' ? 'user-defined' : value === 'predefined' ? 'predefined' : 'solid';
          const patternType = fillType === 'solid' ? 'solid' : 'pattern';
          if (hatch) {
            // Switch σε predefined χωρίς όνομα → δώσε το default ώστε να φανεί αμέσως.
            const patch: Record<string, unknown> = { fillType, patternType };
            if (fillType === 'predefined' && !hatch.patternName) patch.patternName = defaults.patternName;
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
        // islandStyle
        const islandStyle = value === 'outer' ? 'outer' : value === 'ignore' ? 'ignore' : 'normal';
        if (hatch) patchHatch(hatch, { islandStyle });
        else setHatchDrawDefaults({ islandStyle });
        return;
      }
      if (isHatchRibbonNumberKey(commandKey)) {
        const numeric = Number.parseFloat(value);
        if (Number.isNaN(numeric)) return;
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
    [resolveHatch, patchHatch, defaults],
  );

  const onToggle = useCallback(
    (commandKey: string, nextValue: boolean): void => {
      if (!isHatchRibbonToggleKey(commandKey)) return;
      const hatch = resolveHatch();
      if (hatch) patchHatch(hatch, { doubleCrossHatch: nextValue || undefined });
      else setHatchDrawDefaults({ doubleCrossHatch: nextValue });
    },
    [resolveHatch, patchHatch],
  );

  const getToggleState = useCallback(
    (commandKey: string): RibbonToggleState => {
      if (!isHatchRibbonToggleKey(commandKey)) return NULL_TOGGLE;
      const hatch = resolveHatch();
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
      if (action === HATCH_RIBBON_KEYS.actions.close) {
        EventBus.emit('bim:select-none' as Parameters<typeof EventBus.emit>[0], undefined);
      }
    },
    [resolveHatch, levelManager, executeCommand, t],
  );

  return useMemo(
    () => ({ onComboboxChange, getComboboxState, onToggle, getToggleState, onAction }),
    [onComboboxChange, getComboboxState, onToggle, getToggleState, onAction],
  );
}

/** Type guard — exposed ώστε ο `routeRibbonAction` να δρομολογεί hatch action keys. */
export function isHatchActionKey(action: string): boolean {
  return isHatchRibbonActionKey(action);
}
