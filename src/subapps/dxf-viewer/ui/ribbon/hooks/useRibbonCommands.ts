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
import { isArrayRibbonKey, isArrayRibbonStringKey, isArrayRibbonToggleKey } from './bridge/array-command-keys';

interface UseRibbonCommandsProps {
  handleToolChange: (tool: ToolType) => void;
  handleRibbonComingSoon: (label: string) => void;
  wrappedHandleAction: (action: string, data?: RibbonActionPayload) => void;
  textEditorBridge: RibbonTextEditorBridge;
  /** ADR-353 Phase A — Array contextual tab bridge. */
  arrayBridge: RibbonArrayBridge;
}

export function useRibbonCommands({
  handleToolChange,
  handleRibbonComingSoon,
  wrappedHandleAction,
  textEditorBridge,
  arrayBridge,
}: UseRibbonCommandsProps): RibbonCommandsApi {
  // Compose: array-prefixed keys route to arrayBridge; everything else
  // falls through to the text-editor bridge. Both bridges no-op on keys
  // they don't own, but the array prefix check short-circuits cheaply.
  const onComboboxChange = React.useCallback(
    (key: string, value: string) => {
      if (isArrayRibbonKey(key) || isArrayRibbonStringKey(key)) {
        arrayBridge.onComboboxChange(key, value);
        return;
      }
      textEditorBridge.onComboboxChange(key, value);
    },
    [arrayBridge, textEditorBridge],
  );

  const getComboboxState = React.useCallback(
    (key: string): RibbonComboboxState | null => {
      if (isArrayRibbonKey(key) || isArrayRibbonStringKey(key)) return arrayBridge.getComboboxState(key);
      return textEditorBridge.getComboboxState(key);
    },
    [arrayBridge, textEditorBridge],
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

  return React.useMemo(
    () => ({
      onToolChange: handleToolChange,
      onComingSoon: handleRibbonComingSoon,
      onAction: wrappedHandleAction,
      onToggle,
      onComboboxChange,
      getToggleState,
      getComboboxState,
    }),
    [
      handleToolChange,
      handleRibbonComingSoon,
      wrappedHandleAction,
      onToggle,
      onComboboxChange,
      getToggleState,
      getComboboxState,
    ],
  );
}
