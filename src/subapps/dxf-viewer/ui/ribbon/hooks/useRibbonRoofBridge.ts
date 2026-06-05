'use client';

/**
 * ADR-417 Φ1-part-2 — Bridge μεταξύ contextual Roof ribbon tab και active
 * `RoofEntity` params.
 *
 * Mirrors `useRibbonSlabBridge`: read state via `getComboboxState`, write via
 * `onComboboxChange`. Κάθε mutation περνά από `UpdateRoofParamsCommand` (via
 * `useCommandHistory().execute`) ώστε να είναι undoable + geometry/validation
 * recompute atomically. `useRoofPersistence` παίρνει την αλλαγή μέσω debounced
 * auto-save. Ribbon edits use `isDragging=false` → κάθε edit = δικό του undo entry.
 *
 * Σε αντίθεση με το slab (καθαρό field-mapping), η στέγη έχει **derived** UI:
 *   - **Μορφή** (flat/mono/gable) → `applyRoofShapePreset` ξαναχτίζει τα `edges`.
 *   - **Κλίση** → re-apply του preset με νέα τιμή (διατηρεί τη μορφή).
 *   - **Toggle μοίρες↔ποσοστό** → μετατρέπει κάθε `edges[].slope` με
 *     `roofSlopeToRatio`/`roofSlopeFromRatio` ώστε η γεωμετρία να μένει ίδια.
 *   - **Roof Type** → assign `typeId` + φέρνει `dna`/`thickness` από το built-in
 *     type (minimal — full edit-dialog/re-resolution = ADR-417 §10 #3).
 *
 * No-ops για commandKeys εκτός `ROOF_RIBBON_KEYS` ώστε να composeί στο
 * `useRibbonCommands`.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-417-bim-roof-element.md §10
 * @see ui/ribbon/hooks/useRibbonSlabBridge.ts — το πρότυπο
 */

import { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { isRoofEntity } from '../../../types/entities';
import {
  DEFAULT_ROOF_SLOPE_DEG,
  type RoofEntity,
  type RoofParams,
  type RoofShape,
  type RoofSlopeUnit,
} from '../../../bim/types/roof-types';
import {
  applyRoofShapePreset,
  roofSlopeFromRatio,
  roofSlopeToRatio,
} from '../../../bim/geometry/roof-geometry';
import { useCommandHistory } from '../../../core/commands';
import { UpdateRoofParamsCommand } from '../../../core/commands/entity-commands/UpdateRoofParamsCommand';
import { LevelSceneManagerAdapter } from '../../../systems/entity-creation/LevelSceneManagerAdapter';
import {
  ROOF_RIBBON_KEYS,
  ROOF_RIBBON_KEYS_ACTIONS,
  ROOF_RIBBON_TOGGLE_KEYS,
  ROOF_RIBBON_BADGE_KEYS,
} from './bridge/roof-command-keys';
import { EventBus } from '../../../systems/events/EventBus';
import type {
  RibbonComboboxState,
  RibbonToggleState,
} from '../context/RibbonCommandContext';
import type { RibbonComboboxOption } from '../types/ribbon-types';
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

export interface UseRibbonRoofBridgeProps {
  readonly levelManager: LevelManagerLike;
  readonly universalSelection: UniversalSelectionLike;
}

export interface RibbonRoofBridge {
  readonly onComboboxChange: (commandKey: string, value: string) => void;
  readonly getComboboxState: (commandKey: string) => RibbonComboboxState | null;
  readonly onToggle: (commandKey: string, nextValue: boolean) => void;
  readonly getToggleState: (commandKey: string) => RibbonToggleState;
  /** Returns `true` όταν το currently selected roof έχει code violations. */
  readonly getBadgeState: (badgeKey: string) => boolean;
  /** Handles ribbon simple-button actions (close / delete). */
  readonly onAction: (action: string) => void;
}

const ROOF_OWNED_BADGE_KEYS: ReadonlySet<string> = new Set<string>([
  ROOF_RIBBON_BADGE_KEYS.violations,
]);

const NULL_TOGGLE: RibbonToggleState = false;

/** Slope-preset options ανά μονάδα — μοίρες vs ποσοστό (literal labels). */
const SLOPE_DEG_OPTIONS: readonly RibbonComboboxOption[] = [10, 15, 20, 25, 30, 35, 40, 45].map(
  (v) => ({ value: String(v), labelKey: `${v}°`, isLiteralLabel: true }),
);
const SLOPE_PCT_OPTIONS: readonly RibbonComboboxOption[] = [10, 20, 30, 40, 50, 60, 75, 100].map(
  (v) => ({ value: String(v), labelKey: `${v}%`, isLiteralLabel: true }),
);

/** Κλειδώνει το derived `geometry.shape` στις preset μορφές (complex → flat). */
function clampShape(shape: RoofShape): 'flat' | 'mono-pitch' | 'gable' | 'hip' {
  return shape === 'mono-pitch' || shape === 'gable' || shape === 'hip' ? shape : 'flat';
}

/** Τρέχουσα τιμή κλίσης = η 1η slope-defining ακμή· fallback = default (στη μονάδα). */
function currentSlope(params: RoofParams): number {
  const edge = params.edges.find((e) => e.definesSlope);
  if (edge) return edge.slope;
  return params.slopeUnit === 'percent'
    ? roofSlopeFromRatio(roofSlopeToRatio(DEFAULT_ROOF_SLOPE_DEG, 'deg'), 'percent')
    : DEFAULT_ROOF_SLOPE_DEG;
}

export function useRibbonRoofBridge(
  props: UseRibbonRoofBridgeProps,
): RibbonRoofBridge {
  const { levelManager, universalSelection } = props;
  const { execute: executeCommand } = useCommandHistory();
  const { t } = useTranslation('dxf-viewer-shell');

  const resolveRoof = useCallback((): RoofEntity | null => {
    const id = universalSelection.getPrimaryId();
    if (!id || !levelManager.currentLevelId) return null;
    const scene = levelManager.getLevelScene(levelManager.currentLevelId);
    if (!scene) return null;
    const e = scene.entities.find((x) => x.id === id);
    if (!e || !isRoofEntity(e)) return null;
    return e;
  }, [levelManager, universalSelection]);

  /**
   * Dispatch the params patch through `UpdateRoofParamsCommand` so the change is
   * undoable + geometry/validation recompute atomically. `useRoofPersistence`
   * picks up the patched entity via debounced auto-save.
   */
  const dispatchParams = useCallback(
    (roof: RoofEntity, nextParams: RoofParams): void => {
      if (!levelManager.currentLevelId) return;
      const sm = new LevelSceneManagerAdapter(
        levelManager.getLevelScene,
        levelManager.setLevelScene,
        levelManager.currentLevelId,
      );
      executeCommand(
        new UpdateRoofParamsCommand(roof.id, nextParams, roof.params, sm, false),
      );
      EventBus.emit('bim:roof-params-updated', { roofId: roof.id });
    },
    [executeCommand, levelManager],
  );

  const getComboboxState = useCallback(
    (commandKey: string): RibbonComboboxState | null => {
      const roof = resolveRoof();
      if (!roof) return null;
      switch (commandKey) {
        case ROOF_RIBBON_KEYS.stringParams.shape:
          return { value: clampShape(roof.geometry.shape), options: [] };
        case ROOF_RIBBON_KEYS.params.slope:
          return {
            value: String(Math.round(currentSlope(roof.params))),
            options: roof.params.slopeUnit === 'percent' ? SLOPE_PCT_OPTIONS : SLOPE_DEG_OPTIONS,
          };
        case ROOF_RIBBON_KEYS.params.basePivotZ:
          return { value: String(Math.round(roof.params.basePivotZ)), options: [] };
        default:
          return null;
      }
    },
    [resolveRoof],
  );

  const onComboboxChange = useCallback(
    (commandKey: string, value: string): void => {
      const roof = resolveRoof();
      if (!roof) return;
      const p = roof.params;

      switch (commandKey) {
        case ROOF_RIBBON_KEYS.stringParams.shape: {
          const shape = value as 'flat' | 'mono-pitch' | 'gable' | 'hip';
          const edges = applyRoofShapePreset(p.outline, shape, currentSlope(p), p.slopeUnit);
          dispatchParams(roof, { ...p, edges });
          return;
        }
        case ROOF_RIBBON_KEYS.params.slope: {
          const slope = Number.parseFloat(value);
          if (Number.isNaN(slope) || slope <= 0) return;
          const shape = clampShape(roof.geometry.shape);
          // flat → καμία slope-defining ακμή· πρώτα διάλεξε μορφή.
          const edges = applyRoofShapePreset(p.outline, shape, slope, p.slopeUnit);
          dispatchParams(roof, { ...p, edges });
          return;
        }
        case ROOF_RIBBON_KEYS.params.basePivotZ: {
          const basePivotZ = Number.parseFloat(value);
          if (Number.isNaN(basePivotZ)) return;
          dispatchParams(roof, { ...p, basePivotZ });
          return;
        }
        default:
          return;
      }
    },
    [resolveRoof, dispatchParams],
  );

  const onToggle = useCallback(
    (key: string, next: boolean): void => {
      if (key !== ROOF_RIBBON_TOGGLE_KEYS.slopeUnitPercent) return;
      const roof = resolveRoof();
      if (!roof) return;
      const p = roof.params;
      const nextUnit: RoofSlopeUnit = next ? 'percent' : 'deg';
      if (nextUnit === p.slopeUnit) return;
      // Convert κάθε κλίση ώστε η γεωμετρία (rise/run) να μένει αμετάβλητη.
      const edges = p.edges.map((e) =>
        e.definesSlope
          ? { ...e, slope: roofSlopeFromRatio(roofSlopeToRatio(e.slope, p.slopeUnit), nextUnit) }
          : e,
      );
      dispatchParams(roof, { ...p, slopeUnit: nextUnit, edges });
    },
    [resolveRoof, dispatchParams],
  );

  const getToggleState = useCallback(
    (key: string): RibbonToggleState => {
      if (key !== ROOF_RIBBON_TOGGLE_KEYS.slopeUnitPercent) return NULL_TOGGLE;
      const roof = resolveRoof();
      return roof ? roof.params.slopeUnit === 'percent' : NULL_TOGGLE;
    },
    [resolveRoof],
  );

  const getBadgeState = useCallback(
    (badgeKey: string): boolean => {
      if (!ROOF_OWNED_BADGE_KEYS.has(badgeKey)) return false;
      const roof = resolveRoof();
      if (!roof) return false;
      if (badgeKey === ROOF_RIBBON_BADGE_KEYS.violations) {
        return roof.validation.hasCodeViolations;
      }
      return false;
    },
    [resolveRoof],
  );

  const onAction = useCallback(
    (action: string): void => {
      if (action !== ROOF_RIBBON_KEYS_ACTIONS.delete) return;
      const roof = resolveRoof();
      if (!roof) return;
      const confirmed = window.confirm(t('ribbon.commands.roofEditor.deleteConfirm'));
      if (!confirmed) return;
      EventBus.emit('bim:roof-delete-requested', { roofId: roof.id });
    },
    [resolveRoof, t],
  );

  return useMemo(
    () => ({ onComboboxChange, getComboboxState, onToggle, getToggleState, getBadgeState, onAction }),
    [onComboboxChange, getComboboxState, onToggle, getToggleState, getBadgeState, onAction],
  );
}

/** Type guard used by `useRibbonCommands` composer. */
export function isRoofBadgeKey(badgeKey: string): boolean {
  return ROOF_OWNED_BADGE_KEYS.has(badgeKey);
}

/** Exposed so action interceptor μπορεί να αναγνωρίσει `roof.actions.close`. */
export const ROOF_BRIDGE_ACTIONS = ROOF_RIBBON_KEYS_ACTIONS;
