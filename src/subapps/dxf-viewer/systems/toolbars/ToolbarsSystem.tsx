'use client';

import React, { createContext, useContext, useState } from 'react';
import type { 
  ToolType, 
  ToolbarState, 
  ToolRunner, 
  ToolEvents 
} from './config';
import { DEFAULT_TOOLBAR_SETTINGS } from './config';
import { ToolbarSystemUtils } from './utils';
import type { ToolbarsContextType, ToolbarsSystemProps } from './ToolbarsContext.types';
import { useToolManagement } from './hooks/useToolManagement';
import { useDefinitionManagement } from './hooks/useDefinitionManagement';
import { useToolbarManagement } from './hooks/useToolbarManagement';
import { useToolRunnerManagement } from './hooks/useToolRunnerManagement';
import { useUtilityManagement } from './hooks/useUtilityManagement';
import { useToolbarsContextValue } from './hooks/useToolbarsContextValue';

export const ToolbarsContext = createContext<ToolbarsContextType | null>(null);

export function ToolbarsSystem({
  children,
  initialToolbars = {},
  initialTools = {},
  initialActions = {},
  initialSettings = {},
  onToolChange,
  onError
}: ToolbarsSystemProps) {

  // ===== STATE MANAGEMENT =====
  const [state, setState] = useState<ToolbarState>({
    toolbars: initialToolbars,
    tools: initialTools,
    actions: initialActions,
    activeTool: null,
    activeToolbar: null,
    toolStates: {},
    actionStates: {},
    customizations: [],
    settings: {
      ...DEFAULT_TOOLBAR_SETTINGS,
      ...initialSettings
    }
  });

  const [toolRunner, setToolRunner] = useState<ToolRunner>(
    ToolbarSystemUtils.createToolRunner()
  );

  const [eventListeners, setEventListeners] = useState<Partial<ToolEvents>>({});
  const [hotkeys, setHotkeys] = useState<Record<string, ToolType>>({});

  // ===== TOOL MANAGEMENT =====
  const {
    activateTool,
    deactivateTool,
    toggleTool,
    executeAction,
    getActiveTool,
    isToolActive,
    isToolEnabled,
    isToolVisible
  } = useToolManagement({
    state,
    setState,
    toolRunner,
    setToolRunner,
    eventListeners,
    onToolChange,
    onError
  });

  // ===== TOOL & ACTION DEFINITION MANAGEMENT =====
  const {
    registerTool,
    unregisterTool,
    updateTool,
    getTool,
    getTools,
    getToolsByCategory,
    registerAction,
    unregisterAction,
    updateAction,
    getAction,
    getActions
  } = useDefinitionManagement({ state, setState, onError });

  // ===== TOOLBAR CONFIGURATION MANAGEMENT =====
  const {
    createToolbar,
    deleteToolbar,
    getToolbar,
    getToolbars,
    getVisibleToolbars
  } = useToolbarManagement({ state, setState, onError });

  // ===== TOOL RUNNER FUNCTIONS =====
  const {
    startTool,
    cancelTool,
    completeTool,
    addToolInput,
    removeLastInput,
    clearToolInputs,
    getToolProgress
  } = useToolRunnerManagement({
    toolRunner,
    setToolRunner,
    activateTool,
    deactivateTool,
    eventListeners
  });

  // ===== UTILITY MANAGEMENT (HOTKEYS, SETTINGS, UTILITIES, EFFECTS) =====
  const {
    registerHotkey,
    unregisterHotkey,
    executeHotkey,
    getHotkeys,
    updateSettings,
    resetSettings,
    getSettings,
    searchTools,
    getToolTooltip
  } = useUtilityManagement({
    state,
    setState,
    activateTool,
    eventListeners
  });

  // ===== CONTEXT VALUE =====
  const contextValue = useToolbarsContextValue({
    state,
    toolRunner,
    setState,
    setEventListeners,
    activateTool,
    deactivateTool,
    toggleTool,
    executeAction,
    registerTool,
    unregisterTool,
    updateTool,
    getTool,
    getTools,
    getToolsByCategory,
    registerAction,
    unregisterAction,
    updateAction,
    getAction,
    getActions,
    createToolbar,
    deleteToolbar,
    getToolbar,
    getToolbars,
    getVisibleToolbars,
    startTool,
    cancelTool,
    completeTool,
    addToolInput,
    removeLastInput,
    clearToolInputs,
    getToolProgress,
    registerHotkey,
    unregisterHotkey,
    executeHotkey,
    getHotkeys,
    updateSettings,
    resetSettings,
    getSettings,
    searchTools,
    getToolTooltip
  });

  return (
    <ToolbarsContext.Provider value={contextValue}>
      {children}
    </ToolbarsContext.Provider>
  );
}

// ===== HOOK FOR USING THE CONTEXT =====
export function useToolbarsContext(): ToolbarsContextType {
  const context = useContext(ToolbarsContext);
  if (!context) {
    throw new Error('useToolbarsContext must be used within a ToolbarsSystem');
  }
  return context;
}