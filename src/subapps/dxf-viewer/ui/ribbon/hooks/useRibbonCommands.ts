import React from 'react';
import { useAnimationStore } from '../../../bim-3d/animation/AnimationStore';
import { SNAP_STEP_PRESETS } from '../../../bim-3d/animation/snap-quantizer';
import type { ToolType } from '../../toolbar/types';
import type {
  RibbonCommandsApi,
  RibbonActionPayload,
  RibbonComboboxState,
  RibbonToggleState,
} from '../context/RibbonCommandContext';
import type { RibbonTextEditorBridge } from './useRibbonTextEditorBridge';
import type { RibbonArrayBridge } from './useRibbonArrayBridge';
import type { RibbonStairBridge } from '../../../bim/hooks/use-ribbon-stair-bridge';
import { isStairBadgeKey, isStairPanelVisibilityKey } from '../../../bim/hooks/use-ribbon-stair-bridge';
import type { RibbonWallBridge } from './useRibbonWallBridge';
import { isWallBadgeKey } from './useRibbonWallBridge';
import type { RibbonOpeningBridge } from './useRibbonOpeningBridge';
import { isOpeningBadgeKey } from './useRibbonOpeningBridge';
import type { RibbonSlabBridge } from './useRibbonSlabBridge';
import { isSlabBadgeKey } from './useRibbonSlabBridge';
import type { RibbonColumnBridge } from './useRibbonColumnBridge';
import { isColumnBadgeKey, isColumnPanelVisibilityKey } from './useRibbonColumnBridge';
import type { RibbonBeamBridge } from './useRibbonBeamBridge';
import { isBeamBadgeKey, isBeamPanelVisibilityKey } from './useRibbonBeamBridge';
import type { RibbonSlabOpeningBridge } from './useRibbonSlabOpeningBridge';
import { isSlabOpeningBadgeKey } from './useRibbonSlabOpeningBridge';
import type { RibbonMepCircuitBridge } from './useRibbonMepCircuitBridge';
import { isMepCircuitActionKey } from './bridge/mep-circuit-command-keys';
import type { RibbonMepFixtureBridge } from './useRibbonMepFixtureBridge';
import { isMepFixturePanelVisibilityKey } from './useRibbonMepFixtureBridge';
import {
  isMepFixtureRibbonKey,
  isMepFixtureRibbonStringKey,
  isMepFixtureActionKey,
} from './bridge/mep-fixture-command-keys';
import type { RibbonFurnitureBridge } from './useRibbonFurnitureBridge';
import { isFurniturePanelVisibilityKey } from './useRibbonFurnitureBridge';
import {
  isFurnitureRibbonKey,
  isFurnitureRibbonStringKey,
  isFurnitureActionKey,
} from './bridge/furniture-command-keys';
import type { RibbonMepFixtureLibraryBridge } from './useRibbonMepFixtureLibraryBridge';
import {
  isMepFixtureLibraryKey,
  isMepFixtureLibraryStringKey,
} from './bridge/mep-fixture-library-command-keys';
import type { RibbonLineToolBridge } from './useRibbonLineToolBridge';
import { isArrayRibbonKey, isArrayRibbonStringKey, isArrayRibbonToggleKey } from './bridge/array-command-keys';
import { isStairRibbonKey, isStairRibbonStringKey, isStairActionKey } from './bridge/stair-command-keys';
import { isWallRibbonKey, isWallRibbonStringKey, isWallRibbonToggleKey, isWallActionKey } from './bridge/wall-command-keys';
import { isOpeningRibbonKey, isOpeningRibbonStringKey, isOpeningActionKey, isOpeningTagStyleComboboxKey, isOpeningTagStyleToggleKey } from './bridge/opening-command-keys';
import { isSlabRibbonKey, isSlabRibbonStringKey, isSlabActionKey } from './bridge/slab-command-keys';
import { isColumnRibbonKey, isColumnRibbonStringKey, isColumnActionKey } from './bridge/column-command-keys';
import { isBeamRibbonKey, isBeamRibbonStringKey, isBeamActionKey } from './bridge/beam-command-keys';
import { isSlabOpeningRibbonStringKey, isSlabOpeningActionKey } from './bridge/slab-opening-command-keys';
import { isLineToolRibbonKey } from './bridge/line-tool-command-keys';
import { isXlineRibbonKey } from './bridge/xline-command-keys';
import type { RibbonXlineModeBridge } from './useRibbonXlineModeBridge';

interface UseRibbonCommandsProps {
  /** ADR-345 Fase 5.6 — current tool from useDxfViewerState. Drives Large /
   * Small / Split button active visual state. */
  activeTool: ToolType | null;
  handleToolChange: (tool: ToolType) => void;
  handleRibbonComingSoon: (label: string) => void;
  wrappedHandleAction: (action: string, data?: RibbonActionPayload) => void;
  /** ADR-345 Fase 5.7 — CommandHistory availability for tab-bar undo/redo. */
  canUndo: boolean;
  canRedo: boolean;
  textEditorBridge: RibbonTextEditorBridge;
  /** ADR-353 Phase A — Array contextual tab bridge. */
  arrayBridge: RibbonArrayBridge;
  /** ADR-358 Phase 7a — Stair contextual tab bridge. */
  stairBridge: RibbonStairBridge;
  /** ADR-363 Phase 1B — Wall contextual tab bridge. */
  wallBridge: RibbonWallBridge;
  /** ADR-363 Phase 2 — Opening contextual tab bridge. */
  openingBridge: RibbonOpeningBridge;
  /** ADR-363 Phase 3 — Slab contextual tab bridge. */
  slabBridge: RibbonSlabBridge;
  /** ADR-363 Phase 4 — Column contextual tab bridge. */
  columnBridge: RibbonColumnBridge;
  /** ADR-363 Phase 5 — Beam contextual tab bridge. */
  beamBridge: RibbonBeamBridge;
  /** ADR-363 Phase 3.7 — Slab-opening contextual tab bridge. */
  slabOpeningBridge: RibbonSlabOpeningBridge;
  /** ADR-408 Φ5 — MEP circuit contextual tab bridge (create-from-selection). */
  mepCircuitBridge: RibbonMepCircuitBridge;
  /** ADR-406 — MEP fixture (φωτιστικό) contextual tab bridge. */
  mepFixtureBridge: RibbonMepFixtureBridge;
  /** ADR-410 — furniture library contextual tab bridge. */
  furnitureBridge: RibbonFurnitureBridge;
  /** ADR-411 — light-fixture library contextual tab bridge (tool-active picker). */
  mepFixtureLibraryBridge: RibbonMepFixtureLibraryBridge;
  /** ADR-357 Phase 17 — Line tool Quick Style bridge. */
  lineToolBridge: RibbonLineToolBridge;
  /** ADR-359 Phase 10.b — XLine mode bridge. */
  xlineModeBridge: RibbonXlineModeBridge;
}

/** Combobox options for the animation snap step (mirrors SNAP_STEP_PRESETS). */
const SNAP_STEP_COMBOBOX_OPTIONS = SNAP_STEP_PRESETS.map((v) => ({
  value: String(v),
  labelKey: `animation.snapStepOptions.${v % 1 === 0 ? String(Math.round(v)) : String(v)}`,
}));

export function useRibbonCommands({
  activeTool,
  handleToolChange,
  handleRibbonComingSoon,
  wrappedHandleAction,
  canUndo,
  canRedo,
  textEditorBridge,
  arrayBridge,
  stairBridge,
  wallBridge,
  openingBridge,
  slabBridge,
  columnBridge,
  beamBridge,
  slabOpeningBridge,
  mepCircuitBridge,
  mepFixtureBridge,
  furnitureBridge,
  mepFixtureLibraryBridge,
  lineToolBridge,
  xlineModeBridge,
}: UseRibbonCommandsProps): RibbonCommandsApi {
  // ADR-366 §C.1.b snap-to-grid — subscribe so ribbon re-renders on snap change.
  const snapEnabled = useAnimationStore((s) => s.snapEnabled);
  const snapStepUnits = useAnimationStore((s) => s.snapStepUnits);

  // Compose: stair-prefixed keys → stairBridge; array-prefixed → arrayBridge;
  // everything else falls through to the text-editor bridge. All bridges
  // no-op on keys they don't own, but the prefix checks short-circuit.
  const onComboboxChange = React.useCallback(
    (key: string, value: string) => {
      if (key === 'animation.snap-step') {
        const step = parseFloat(value);
        if (!Number.isNaN(step) && step > 0) {
          useAnimationStore.getState().setSnapStepUnits(step);
        }
        return;
      }
      if (isStairRibbonKey(key) || isStairRibbonStringKey(key)) {
        stairBridge.onComboboxChange(key, value);
        return;
      }
      if (isWallRibbonKey(key) || isWallRibbonStringKey(key) || isWallRibbonToggleKey(key)) {
        wallBridge.onComboboxChange(key, value);
        return;
      }
      if (isOpeningRibbonKey(key) || isOpeningRibbonStringKey(key) || isOpeningTagStyleComboboxKey(key)) {
        openingBridge.onComboboxChange(key, value);
        return;
      }
      if (isSlabRibbonKey(key) || isSlabRibbonStringKey(key)) {
        slabBridge.onComboboxChange(key, value);
        return;
      }
      if (isColumnRibbonKey(key) || isColumnRibbonStringKey(key)) {
        columnBridge.onComboboxChange(key, value);
        return;
      }
      if (isBeamRibbonKey(key) || isBeamRibbonStringKey(key)) {
        beamBridge.onComboboxChange(key, value);
        return;
      }
      if (isSlabOpeningRibbonStringKey(key)) {
        slabOpeningBridge.onComboboxChange(key, value);
        return;
      }
      if (isMepFixtureRibbonKey(key) || isMepFixtureRibbonStringKey(key)) {
        mepFixtureBridge.onComboboxChange(key, value);
        return;
      }
      if (isFurnitureRibbonKey(key) || isFurnitureRibbonStringKey(key)) {
        furnitureBridge.onComboboxChange(key, value);
        return;
      }
      if (isMepFixtureLibraryKey(key) || isMepFixtureLibraryStringKey(key)) {
        mepFixtureLibraryBridge.onComboboxChange(key, value);
        return;
      }
      if (isArrayRibbonKey(key) || isArrayRibbonStringKey(key)) {
        arrayBridge.onComboboxChange(key, value);
        return;
      }
      if (isLineToolRibbonKey(key)) {
        lineToolBridge.onComboboxChange(key, value);
        return;
      }
      if (isXlineRibbonKey(key)) {
        xlineModeBridge.onComboboxChange(key, value);
        return;
      }
      textEditorBridge.onComboboxChange(key, value);
    },
    [stairBridge, wallBridge, openingBridge, slabBridge, columnBridge, beamBridge, slabOpeningBridge, mepFixtureBridge, furnitureBridge, mepFixtureLibraryBridge, arrayBridge, lineToolBridge, xlineModeBridge, textEditorBridge],
  );

  const getComboboxState = React.useCallback(
    (key: string): RibbonComboboxState | null => {
      if (key === 'animation.snap-step') {
        return { value: String(snapStepUnits), options: SNAP_STEP_COMBOBOX_OPTIONS };
      }
      if (isStairRibbonKey(key) || isStairRibbonStringKey(key)) return stairBridge.getComboboxState(key);
      if (isWallRibbonKey(key) || isWallRibbonStringKey(key) || isWallRibbonToggleKey(key)) return wallBridge.getComboboxState(key);
      if (isOpeningRibbonKey(key) || isOpeningRibbonStringKey(key) || isOpeningTagStyleComboboxKey(key)) return openingBridge.getComboboxState(key);
      if (isSlabRibbonKey(key) || isSlabRibbonStringKey(key)) return slabBridge.getComboboxState(key);
      if (isColumnRibbonKey(key) || isColumnRibbonStringKey(key)) return columnBridge.getComboboxState(key);
      if (isBeamRibbonKey(key) || isBeamRibbonStringKey(key)) return beamBridge.getComboboxState(key);
      if (isSlabOpeningRibbonStringKey(key)) return slabOpeningBridge.getComboboxState(key);
      if (isMepFixtureRibbonKey(key) || isMepFixtureRibbonStringKey(key)) return mepFixtureBridge.getComboboxState(key);
      if (isFurnitureRibbonKey(key) || isFurnitureRibbonStringKey(key)) return furnitureBridge.getComboboxState(key);
      if (isMepFixtureLibraryKey(key) || isMepFixtureLibraryStringKey(key)) return mepFixtureLibraryBridge.getComboboxState(key);
      if (isArrayRibbonKey(key) || isArrayRibbonStringKey(key)) return arrayBridge.getComboboxState(key);
      if (isLineToolRibbonKey(key)) return lineToolBridge.getComboboxState(key);
      if (isXlineRibbonKey(key)) return xlineModeBridge.getComboboxState(key);
      return textEditorBridge.getComboboxState(key);
    },
    [snapStepUnits, stairBridge, wallBridge, openingBridge, slabBridge, columnBridge, beamBridge, slabOpeningBridge, mepFixtureBridge, furnitureBridge, mepFixtureLibraryBridge, arrayBridge, lineToolBridge, xlineModeBridge, textEditorBridge],
  );

  const onToggle = React.useCallback(
    (key: string, next: boolean) => {
      if (isWallRibbonToggleKey(key)) {
        wallBridge.onToggle(key, next);
        return;
      }
      if (isArrayRibbonToggleKey(key)) {
        arrayBridge.onToggle(key, next);
        return;
      }
      if (isOpeningTagStyleToggleKey(key)) {
        openingBridge.onToggle(key, next);
        return;
      }
      textEditorBridge.onToggle(key, next);
    },
    [wallBridge, arrayBridge, openingBridge, textEditorBridge],
  );

  const getToggleState = React.useCallback(
    (key: string): RibbonToggleState => {
      if (key === 'animation.snap-toggle') return snapEnabled;
      if (isWallRibbonToggleKey(key)) return wallBridge.getToggleState(key);
      if (isArrayRibbonToggleKey(key)) return arrayBridge.getToggleState(key);
      if (isOpeningTagStyleToggleKey(key)) return openingBridge.getToggleState(key);
      return textEditorBridge.getToggleState(key);
    },
    [snapEnabled, wallBridge, arrayBridge, openingBridge, textEditorBridge],
  );

  // ADR-358 Phase 7b1 — Stair bridge owns badge keys; ADR-363 Phase 1B adds
  // wall badge keys for the violation indicator on the wall contextual tab.
  const getBadgeState = React.useCallback(
    (badgeKey: string): boolean => {
      if (isStairBadgeKey(badgeKey)) return stairBridge.getBadgeState(badgeKey);
      if (isWallBadgeKey(badgeKey)) return wallBridge.getBadgeState(badgeKey);
      if (isOpeningBadgeKey(badgeKey)) return openingBridge.getBadgeState(badgeKey);
      if (isSlabBadgeKey(badgeKey)) return slabBridge.getBadgeState(badgeKey);
      if (isColumnBadgeKey(badgeKey)) return columnBridge.getBadgeState(badgeKey);
      if (isBeamBadgeKey(badgeKey)) return beamBridge.getBadgeState(badgeKey);
      if (isSlabOpeningBadgeKey(badgeKey)) return slabOpeningBridge.getBadgeState(badgeKey);
      return false;
    },
    [stairBridge, wallBridge, openingBridge, slabBridge, columnBridge, beamBridge, slabOpeningBridge],
  );

  // ADR-358 Phase 7b2b-β Stream F — Only the stair bridge owns visibility
  // keys today. ADR-363 Phase 8D — column bridge added (polygon/ishape panels).
  // Future bridges add their own owned set + branch here. Default `true` for
  // unowned keys = panel visible (no breaking change).
  const getPanelVisibility = React.useCallback(
    (visibilityKey: string): boolean => {
      if (isStairPanelVisibilityKey(visibilityKey)) return stairBridge.getPanelVisibility(visibilityKey);
      if (isColumnPanelVisibilityKey(visibilityKey)) return columnBridge.getPanelVisibility(visibilityKey);
      if (isBeamPanelVisibilityKey(visibilityKey)) return beamBridge.getPanelVisibility(visibilityKey);
      if (isMepFixturePanelVisibilityKey(visibilityKey)) return mepFixtureBridge.getPanelVisibility(visibilityKey);
      if (isFurniturePanelVisibilityKey(visibilityKey)) return furnitureBridge.getPanelVisibility(visibilityKey);
      return true;
    },
    [stairBridge, columnBridge, beamBridge, mepFixtureBridge, furnitureBridge],
  );

  // ADR-363 Phase 1E — Wall action keys (delete) handled by bridge before
  // falling through to the generic DxfViewerContent action handler.
  const onAction = React.useCallback(
    (action: string, data?: RibbonActionPayload) => {
      if (isWallActionKey(action)) {
        wallBridge.onAction(action);
        return;
      }
      if (isOpeningActionKey(action)) {
        openingBridge.onAction(action);
        return;
      }
      if (isSlabActionKey(action)) {
        slabBridge.onAction(action);
        return;
      }
      if (isColumnActionKey(action)) {
        columnBridge.onAction(action);
        return;
      }
      if (isBeamActionKey(action)) {
        beamBridge.onAction(action);
        return;
      }
      if (isSlabOpeningActionKey(action)) {
        slabOpeningBridge.onAction(action);
        return;
      }
      if (isStairActionKey(action)) {
        stairBridge.onAction(action);
        return;
      }
      if (isMepCircuitActionKey(action)) {
        mepCircuitBridge.onAction(action);
        return;
      }
      if (isMepFixtureActionKey(action)) {
        mepFixtureBridge.onAction(action);
        return;
      }
      if (isFurnitureActionKey(action)) {
        furnitureBridge.onAction(action);
        return;
      }
      wrappedHandleAction(action, data);
    },
    [wallBridge, openingBridge, slabBridge, columnBridge, beamBridge, slabOpeningBridge, stairBridge, mepCircuitBridge, mepFixtureBridge, furnitureBridge, wrappedHandleAction],
  );

  return React.useMemo(
    () => ({
      activeTool,
      onToolChange: handleToolChange,
      onComingSoon: handleRibbonComingSoon,
      onAction,
      canUndo,
      canRedo,
      onToggle,
      onComboboxChange,
      getToggleState,
      getComboboxState,
      getBadgeState,
      getPanelVisibility,
    }),
    [
      activeTool,
      handleToolChange,
      handleRibbonComingSoon,
      onAction,
      canUndo,
      canRedo,
      onToggle,
      onComboboxChange,
      getToggleState,
      getComboboxState,
      getBadgeState,
      getPanelVisibility,
    ],
  );
}
