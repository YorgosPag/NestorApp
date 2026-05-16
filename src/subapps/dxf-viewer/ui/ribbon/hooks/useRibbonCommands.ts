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
import { isArrayRibbonKey, isArrayRibbonStringKey, isArrayRibbonToggleKey } from './bridge/array-command-keys';
import { isStairRibbonKey, isStairRibbonStringKey } from './bridge/stair-command-keys';

interface UseRibbonCommandsProps {
  handleToolChange: (tool: ToolType) => void;
  handleRibbonComingSoon: (label: string) => void;
  wrappedHandleAction: (action: string, data?: RibbonActionPayload) => void;
  textEditorBridge: RibbonTextEditorBridge;
  /** ADR-353 Phase A — Array contextual tab bridge. */
  arrayBridge: RibbonArrayBridge;
  /** ADR-358 Phase 7a — Stair contextual tab bridge. */
  stairBridge: RibbonStairBridge;
}

export function useRibbonCommands({
  handleToolChange,
  handleRibbonComingSoon,
  wrappedHandleAction,
  textEditorBridge,
  arrayBridge,
  stairBridge,
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
      if (isArrayRibbonKey(key) || isArrayRibbonStringKey(key)) {
        arrayBridge.onComboboxChange(key, value);
        return;
      }
      textEditorBridge.onComboboxChange(key, value);
    },
    [stairBridge, arrayBridge, textEditorBridge],
  );

  const getComboboxState = React.useCallback(
    (key: string): RibbonComboboxState | null => {
      if (isStairRibbonKey(key) || isStairRibbonStringKey(key)) return stairBridge.getComboboxState(key);
      if (isArrayRibbonKey(key) || isArrayRibbonStringKey(key)) return arrayBridge.getComboboxState(key);
      return textEditorBridge.getComboboxState(key);
    },
    [stairBridge, arrayBridge, textEditorBridge],
  );

  const onToggle = React.useCallback(
    (key: string, next: boolean) => {
      if (isArrayRibbonToggleKey(key)) {
        arrayBridge.onToggle(key, next);
        return;
      }
      textEditorBridge.onToggle(key, next);
    },
    [arrayBridge, textEditorBridge],
  );

  const getToggleState = React.useCallback(
    (key: string): RibbonToggleState => {
      if (isArrayRibbonToggleKey(key)) return arrayBridge.getToggleState(key);
      return textEditorBridge.getToggleState(key);
    },
    [arrayBridge, textEditorBridge],
  );

  // ADR-358 Phase 7b1 — Only the stair bridge owns badge keys today.
  // Future bridges add their own owned set + branch here.
  const getBadgeState = React.useCallback(
    (badgeKey: string): boolean => {
      if (isStairBadgeKey(badgeKey)) return stairBridge.getBadgeState(badgeKey);
      return false;
    },
    [stairBridge],
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
