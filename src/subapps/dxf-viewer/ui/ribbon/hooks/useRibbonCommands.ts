import React from 'react';
import type { ToolType } from '../../toolbar/types';
import type {
  RibbonCommandsApi,
  RibbonActionPayload,
} from '../context/RibbonCommandContext';
import type { RibbonTextEditorBridge } from './useRibbonTextEditorBridge';

interface UseRibbonCommandsProps {
  handleToolChange: (tool: ToolType) => void;
  handleRibbonComingSoon: (label: string) => void;
  wrappedHandleAction: (action: string, data?: RibbonActionPayload) => void;
  textEditorBridge: RibbonTextEditorBridge;
}

export function useRibbonCommands({
  handleToolChange,
  handleRibbonComingSoon,
  wrappedHandleAction,
  textEditorBridge,
}: UseRibbonCommandsProps): RibbonCommandsApi {
  return React.useMemo(
    () => ({
      onToolChange: handleToolChange,
      onComingSoon: handleRibbonComingSoon,
      onAction: wrappedHandleAction,
      onToggle: textEditorBridge.onToggle,
      onComboboxChange: textEditorBridge.onComboboxChange,
      getToggleState: textEditorBridge.getToggleState,
      getComboboxState: textEditorBridge.getComboboxState,
    }),
    [
      handleToolChange,
      handleRibbonComingSoon,
      wrappedHandleAction,
      textEditorBridge.onToggle,
      textEditorBridge.onComboboxChange,
      textEditorBridge.getToggleState,
      textEditorBridge.getComboboxState,
    ],
  );
}
