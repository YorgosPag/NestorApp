'use client';

/**
 * Bridge μεταξύ του Line-Tool contextual ribbon tab και (α) της επιλεγμένης
 * γεωμετρικής οντότητας ή (β) των draw-defaults (`QuickStyleStore`).
 *
 * Dual mode (Revit «διάλεξε στυλ → σχεδίασε» + «επίλεξε → επεξεργάσου» — mirror
 * του `useRibbonHatchBridge`):
 *   - Επιλεγμένο primitive (γραμμή/πολυγραμμή/κύκλος/τόξο/έλλειψη/spline/ορθογώνιο)
 *     → read/write μέσω του generic `UpdateEntityCommand` (undoable, μηδέν νέα
 *     command class). Αλλάζει το ΙΔΙΟ entity → canvas re-render με το νέο στυλ.
 *   - Καμία επιλογή (εργαλείο σχεδίασης ενεργό) → read/write στο `QuickStyleStore`
 *     (ephemeral draw-defaults για την ΕΠΟΜΕΝΗ γραμμή — ADR-357 Phase 17).
 *
 * Το ποια entities είναι «editable primitives» ορίζεται ΜΙΑ φορά στο SSoT
 * `types/style-editable-primitives.ts` — κοινό με τον `resolveContextualTrigger`.
 *
 * Linetype options = live `LinetypeRegistry` (27 ISO + runtime custom), ΟΧΙ
 * στατικό catalog → πλήρες SSoT με ό,τι μπορεί να αποδώσει ο renderer (Φ2A-D).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-510-line-creation-system.md §Φ2E
 * @see docs/centralized-systems/reference/adrs/ADR-357-dxf-line-tool-google-level.md §G15
 */

import { useCallback, useMemo, useSyncExternalStore } from 'react';
import {
  getQuickStyleSnapshot,
  subscribeQuickStyle,
  setQuickStyleLineweight,
  setQuickStyleLinetype,
  setQuickStyleColor,
} from '../../../stores/QuickStyleStore';
import {
  getLinetypeRegistrySnapshot,
  subscribeLinetypeRegistry,
} from '../../../stores/LinetypeRegistry';
import type { LineweightMm, AnySceneEntity } from '../../../types/entities';
import { LINEWEIGHT_SPECIAL } from '../../../config/lineweight-iso-catalog';
import { isStyleEditablePrimitiveType } from '../../../types/style-editable-primitives';
import { useCommandHistory } from '../../../core/commands';
import { UpdateEntityCommand } from '../../../core/commands/entity-commands/UpdateEntityCommand';
import { LevelSceneManagerAdapter } from '../../../systems/entity-creation/LevelSceneManagerAdapter';
import type { RibbonComboboxState } from '../context/RibbonCommandContext';
import type { RibbonComboboxOption } from '../types/ribbon-types';
import {
  LINE_TOOL_RIBBON_KEYS,
  isLineToolRibbonKey,
} from './bridge/line-tool-command-keys';
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

export interface UseRibbonLineToolBridgeProps {
  readonly levelManager: LevelManagerLike;
  readonly universalSelection: UniversalSelectionLike;
}

export interface RibbonLineToolBridge {
  readonly getComboboxState: (commandKey: string) => RibbonComboboxState | null;
  readonly onComboboxChange: (commandKey: string, value: string) => void;
}

const BYLAYER = 'ByLayer';

/** Live linetype options (ByLayer + every registered linetype, ISO + custom). */
function buildLinetypeOptions(
  names: ReadonlyArray<{ readonly name: string }>,
): readonly RibbonComboboxOption[] {
  return [
    { value: BYLAYER, labelKey: BYLAYER, isLiteralLabel: true },
    ...names.map((d) => ({ value: d.name, labelKey: d.name, isLiteralLabel: true })),
  ];
}

/** Combobox display value for an entity's linetype (declared, not resolved — Revit shows «By Layer»). */
function entityLinetypeValue(entity: AnySceneEntity): string {
  return entity.linetypeName && entity.linetypeName.length > 0 ? entity.linetypeName : BYLAYER;
}

/** Combobox display value for an entity's lineweight. */
function entityLineweightValue(entity: AnySceneEntity): string {
  const lw = entity.lineweightMm;
  if (lw === undefined || lw === LINEWEIGHT_SPECIAL.BYLAYER) return BYLAYER;
  return String(lw);
}

/** Combobox display value for an entity's color (ByLayer or ACI number). */
function entityColorValue(entity: AnySceneEntity): string {
  if (entity.colorMode === BYLAYER || entity.colorMode === undefined) return BYLAYER;
  return entity.colorAci != null ? String(entity.colorAci) : BYLAYER;
}

export function useRibbonLineToolBridge(
  props: UseRibbonLineToolBridgeProps,
): RibbonLineToolBridge {
  const { levelManager, universalSelection } = props;
  const { execute: executeCommand } = useCommandHistory();

  const snapshot = useSyncExternalStore(
    subscribeQuickStyle, getQuickStyleSnapshot, getQuickStyleSnapshot,
  );
  // Live linetype catalog (low-frequency: registrations are rare).
  const registry = useSyncExternalStore(
    subscribeLinetypeRegistry, getLinetypeRegistrySnapshot, getLinetypeRegistrySnapshot,
  );

  const linetypeOptions = useMemo(
    () => buildLinetypeOptions(registry.linetypes),
    [registry],
  );

  /** The selected style-editable primitive, or null (→ draw-defaults mode). */
  const resolveSelected = useCallback((): AnySceneEntity | null => {
    const id = universalSelection.getPrimaryId();
    if (!id || !levelManager.currentLevelId) return null;
    const scene = levelManager.getLevelScene(levelManager.currentLevelId);
    const e = scene?.entities.find((x) => x.id === id);
    if (!e || !isStyleEditablePrimitiveType(e.type)) return null;
    return e as AnySceneEntity;
  }, [levelManager, universalSelection]);

  const patchEntity = useCallback(
    (entity: AnySceneEntity, patch: Record<string, unknown>): void => {
      if (!levelManager.currentLevelId) return;
      const sm = new LevelSceneManagerAdapter(
        levelManager.getLevelScene,
        levelManager.setLevelScene,
        levelManager.currentLevelId,
      );
      executeCommand(new UpdateEntityCommand(entity.id, patch, sm, 'Update line style'));
    },
    [executeCommand, levelManager],
  );

  const getComboboxState = useCallback(
    (commandKey: string): RibbonComboboxState | null => {
      if (!isLineToolRibbonKey(commandKey)) return null;
      const selected = resolveSelected();

      if (commandKey === LINE_TOOL_RIBBON_KEYS.linetype) {
        const value = selected ? entityLinetypeValue(selected) : snapshot.linetypeName;
        return { value, options: linetypeOptions };
      }
      if (commandKey === LINE_TOOL_RIBBON_KEYS.lineweight) {
        if (selected) return { value: entityLineweightValue(selected), options: [] };
        const lw = snapshot.lineweightMm;
        return { value: lw === LINEWEIGHT_SPECIAL.BYLAYER ? BYLAYER : String(lw), options: [] };
      }
      // color
      if (selected) return { value: entityColorValue(selected), options: [] };
      const colorValue = snapshot.colorMode === BYLAYER
        ? BYLAYER
        : snapshot.colorAci !== null ? String(snapshot.colorAci) : BYLAYER;
      return { value: colorValue, options: [] };
    },
    [resolveSelected, snapshot, linetypeOptions],
  );

  const onComboboxChange = useCallback(
    (commandKey: string, value: string): void => {
      if (!isLineToolRibbonKey(commandKey)) return;
      const selected = resolveSelected();

      if (commandKey === LINE_TOOL_RIBBON_KEYS.linetype) {
        if (selected) patchEntity(selected, { linetypeName: value });
        else setQuickStyleLinetype(value);
        return;
      }
      if (commandKey === LINE_TOOL_RIBBON_KEYS.lineweight) {
        const lw: LineweightMm = value === BYLAYER
          ? LINEWEIGHT_SPECIAL.BYLAYER
          : (parseFloat(value) as LineweightMm);
        if (selected) patchEntity(selected, { lineweightMm: lw });
        else setQuickStyleLineweight(lw);
        return;
      }
      // color
      if (value === BYLAYER) {
        if (selected) {
          patchEntity(selected, {
            colorMode: 'ByLayer', colorAci: undefined, color: undefined, colorTrueColor: null,
          });
        } else {
          setQuickStyleColor('ByLayer', null, null);
        }
        return;
      }
      const aci = parseInt(value, 10);
      if (selected) {
        patchEntity(selected, {
          colorMode: 'Concrete',
          colorAci: Number.isNaN(aci) ? undefined : aci,
          color: undefined,
          colorTrueColor: null,
        });
      } else {
        setQuickStyleColor('Concrete', Number.isNaN(aci) ? null : aci, null);
      }
    },
    [resolveSelected, patchEntity],
  );

  return useMemo(
    () => ({ getComboboxState, onComboboxChange }),
    [getComboboxState, onComboboxChange],
  );
}
