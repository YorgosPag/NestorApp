import React from 'react';
import type { ToolType } from '../../toolbar/types';
import type {
  RibbonCommandsApi,
  RibbonActionPayload,
  RibbonComboboxState,
  RibbonToggleState,
} from '../context/RibbonCommandContext';
import type { RibbonTextEditorBridge } from './useRibbonTextEditorBridge';
import type { RibbonArrayBridge } from './useRibbonArrayBridge';
import type { RibbonStairBridge } from './useRibbonStairBridge';
import { isStairBadgeKey, isStairPanelVisibilityKey } from './useRibbonStairBridge';
import type { RibbonWallBridge } from './useRibbonWallBridge';
import { isWallBadgeKey } from './useRibbonWallBridge';
import type { RibbonOpeningBridge } from './useRibbonOpeningBridge';
import { isOpeningBadgeKey } from './useRibbonOpeningBridge';
import type { RibbonSlabBridge } from './useRibbonSlabBridge';
import { isSlabBadgeKey } from './useRibbonSlabBridge';
import type { RibbonColumnBridge } from './useRibbonColumnBridge';
import { isColumnBadgeKey } from './useRibbonColumnBridge';
import type { RibbonBeamBridge } from './useRibbonBeamBridge';
import { isBeamBadgeKey } from './useRibbonBeamBridge';
import type { RibbonLineToolBridge } from './useRibbonLineToolBridge';
import { isArrayRibbonKey, isArrayRibbonStringKey, isArrayRibbonToggleKey } from './bridge/array-command-keys';
import { isStairRibbonKey, isStairRibbonStringKey } from './bridge/stair-command-keys';
import { isWallRibbonKey, isWallRibbonStringKey, isWallRibbonToggleKey, isWallActionKey } from './bridge/wall-command-keys';
import { isOpeningRibbonKey, isOpeningRibbonStringKey, isOpeningActionKey } from './bridge/opening-command-keys';
import { isSlabRibbonKey, isSlabRibbonStringKey, isSlabActionKey } from './bridge/slab-command-keys';
import { isColumnRibbonKey, isColumnRibbonStringKey, isColumnActionKey } from './bridge/column-command-keys';
import { isBeamRibbonKey, isBeamRibbonStringKey, isBeamActionKey } from './bridge/beam-command-keys';
import { isLineToolRibbonKey } from './bridge/line-tool-command-keys';

interface UseRibbonCommandsProps {
  /** ADR-345 Fase 5.6 — current tool from useDxfViewerState. Drives Large /
   * Small / Split button active visual state. */
  activeTool: ToolType | null;
  handleToolChange: (tool: ToolType) => void;
  handleRibbonComingSoon: (label: string) => void;
  wrappedHandleAction: (action: string, data?: RibbonActionPayload) => void;
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
  /** ADR-357 Phase 17 — Line tool Quick Style bridge. */
  lineToolBridge: RibbonLineToolBridge;
}

export function useRibbonCommands({
  activeTool,
  handleToolChange,
  handleRibbonComingSoon,
  wrappedHandleAction,
  textEditorBridge,
  arrayBridge,
  stairBridge,
  wallBridge,
  openingBridge,
  slabBridge,
  columnBridge,
  beamBridge,
  lineToolBridge,
}: UseRibbonCommandsProps): RibbonCommandsApi {
  // Compose: stair-prefixed keys → stairBridge; array-prefixed → arrayBridge;
  // everything else falls through to the text-editor bridge. All bridges
  // no-op on keys they don't own, but the prefix checks short-circuit.
  const onComboboxChange = React.useCallback(
    (key: string, value: string) => {
      if (isStairRibbonKey(key) || isStairRibbonStringKey(key)) {
        stairBridge.onComboboxChange(key, value);
        return;
      }
      if (isWallRibbonKey(key) || isWallRibbonStringKey(key) || isWallRibbonToggleKey(key)) {
        wallBridge.onComboboxChange(key, value);
        return;
      }
      if (isOpeningRibbonKey(key) || isOpeningRibbonStringKey(key)) {
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
      if (isArrayRibbonKey(key) || isArrayRibbonStringKey(key)) {
        arrayBridge.onComboboxChange(key, value);
        return;
      }
      if (isLineToolRibbonKey(key)) {
        lineToolBridge.onComboboxChange(key, value);
        return;
      }
      textEditorBridge.onComboboxChange(key, value);
    },
    [stairBridge, wallBridge, openingBridge, slabBridge, columnBridge, beamBridge, arrayBridge, lineToolBridge, textEditorBridge],
  );

  const getComboboxState = React.useCallback(
    (key: string): RibbonComboboxState | null => {
      if (isStairRibbonKey(key) || isStairRibbonStringKey(key)) return stairBridge.getComboboxState(key);
      if (isWallRibbonKey(key) || isWallRibbonStringKey(key) || isWallRibbonToggleKey(key)) return wallBridge.getComboboxState(key);
      if (isOpeningRibbonKey(key) || isOpeningRibbonStringKey(key)) return openingBridge.getComboboxState(key);
      if (isSlabRibbonKey(key) || isSlabRibbonStringKey(key)) return slabBridge.getComboboxState(key);
      if (isColumnRibbonKey(key) || isColumnRibbonStringKey(key)) return columnBridge.getComboboxState(key);
      if (isBeamRibbonKey(key) || isBeamRibbonStringKey(key)) return beamBridge.getComboboxState(key);
      if (isArrayRibbonKey(key) || isArrayRibbonStringKey(key)) return arrayBridge.getComboboxState(key);
      if (isLineToolRibbonKey(key)) return lineToolBridge.getComboboxState(key);
      return textEditorBridge.getComboboxState(key);
    },
    [stairBridge, wallBridge, openingBridge, slabBridge, columnBridge, beamBridge, arrayBridge, lineToolBridge, textEditorBridge],
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
      textEditorBridge.onToggle(key, next);
    },
    [wallBridge, arrayBridge, textEditorBridge],
  );

  const getToggleState = React.useCallback(
    (key: string): RibbonToggleState => {
      if (isWallRibbonToggleKey(key)) return wallBridge.getToggleState(key);
      if (isArrayRibbonToggleKey(key)) return arrayBridge.getToggleState(key);
      return textEditorBridge.getToggleState(key);
    },
    [wallBridge, arrayBridge, textEditorBridge],
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
      return false;
    },
    [stairBridge, wallBridge, openingBridge, slabBridge, columnBridge, beamBridge],
  );

  // ADR-358 Phase 7b2b-β Stream F — Only the stair bridge owns visibility
  // keys today. Future bridges add their own owned set + branch here.
  // Default `true` for unowned keys = panel visible (no breaking change).
  const getPanelVisibility = React.useCallback(
    (visibilityKey: string): boolean => {
      if (isStairPanelVisibilityKey(visibilityKey)) return stairBridge.getPanelVisibility(visibilityKey);
      return true;
    },
    [stairBridge],
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
      wrappedHandleAction(action, data);
    },
    [wallBridge, openingBridge, slabBridge, columnBridge, beamBridge, wrappedHandleAction],
  );

  return React.useMemo(
    () => ({
      activeTool,
      onToolChange: handleToolChange,
      onComingSoon: handleRibbonComingSoon,
      onAction,
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
      onToggle,
      onComboboxChange,
      getToggleState,
      getComboboxState,
      getBadgeState,
      getPanelVisibility,
    ],
  );
}
