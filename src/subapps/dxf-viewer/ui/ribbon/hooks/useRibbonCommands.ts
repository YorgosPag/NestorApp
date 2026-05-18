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
import { isArrayRibbonKey, isArrayRibbonStringKey, isArrayRibbonToggleKey } from './bridge/array-command-keys';
import { isStairRibbonKey, isStairRibbonStringKey } from './bridge/stair-command-keys';
import { isWallRibbonKey, isWallRibbonStringKey, isWallRibbonToggleKey } from './bridge/wall-command-keys';

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
      if (isArrayRibbonKey(key) || isArrayRibbonStringKey(key)) {
        arrayBridge.onComboboxChange(key, value);
        return;
      }
      textEditorBridge.onComboboxChange(key, value);
    },
    [stairBridge, wallBridge, arrayBridge, textEditorBridge],
  );

  const getComboboxState = React.useCallback(
    (key: string): RibbonComboboxState | null => {
      if (isStairRibbonKey(key) || isStairRibbonStringKey(key)) return stairBridge.getComboboxState(key);
      if (isWallRibbonKey(key) || isWallRibbonStringKey(key) || isWallRibbonToggleKey(key)) return wallBridge.getComboboxState(key);
      if (isArrayRibbonKey(key) || isArrayRibbonStringKey(key)) return arrayBridge.getComboboxState(key);
      return textEditorBridge.getComboboxState(key);
    },
    [stairBridge, wallBridge, arrayBridge, textEditorBridge],
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
      return false;
    },
    [stairBridge, wallBridge],
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

  return React.useMemo(
    () => ({
      activeTool,
      onToolChange: handleToolChange,
      onComingSoon: handleRibbonComingSoon,
      onAction: wrappedHandleAction,
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
      wrappedHandleAction,
      onToggle,
      onComboboxChange,
      getToggleState,
      getComboboxState,
      getBadgeState,
      getPanelVisibility,
    ],
  );
}
