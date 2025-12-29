import { useMemo } from 'react';
import type {
  ToolType,
  ToolbarState,
  ToolRunner,
  ToolEvents,
  ToolDefinition,
  ActionDefinition,
  ToolbarConfig,
  ToolbarOperationResult,
  ToolbarsSettings
} from '../config';
import { DEFAULT_TOOLBAR_SETTINGS } from '../config';
import { ToolbarSystemUtils } from '../utils';
import type { ToolbarsContextType } from '../ToolbarsContext.types';

interface ContextValueParams extends ToolbarsContextType {
  setState: React.Dispatch<React.SetStateAction<ToolbarState>>;
  setEventListeners: React.Dispatch<React.SetStateAction<ToolEvents>>;
  unregisterHotkey: (hotkey: string) => void;
  executeHotkey: (hotkey: string) => void;
  getHotkeys: () => Record<string, ToolType>;
  updateSettings: (updates: Partial<ToolbarsSettings>) => void;
  resetSettings: () => void;
  getSettings: () => unknown;
  searchTools: (query: string) => ToolDefinition[];
  getToolTooltip: (toolId: ToolType) => string;
}

export function useToolbarsContextValue(params: ContextValueParams): ToolbarsContextType {
  const {
    state, toolRunner, setState, setEventListeners,
    activateTool, deactivateTool, toggleTool, executeAction,
    registerTool, unregisterTool, updateTool, getTool, getTools, getToolsByCategory,
    registerAction, unregisterAction, updateAction, getAction, getActions,
    createToolbar, deleteToolbar, getToolbar, getToolbars, getVisibleToolbars,
    startTool, cancelTool, completeTool, addToolInput, removeLastInput, clearToolInputs, getToolProgress,
    registerHotkey, unregisterHotkey, executeHotkey, getHotkeys,
    updateSettings, resetSettings, getSettings,
    searchTools, getToolTooltip
  } = params;

  return useMemo<ToolbarsContextType>(() => ({
    // State
    state,
    toolRunner,
    
    // Tool Management
    activateTool,
    deactivateTool,
    toggleTool,
    executeAction,
    getActiveTool: () => state.activeTool,
    isToolActive: (toolId) => state.activeTool === toolId,
    isToolEnabled: (toolId) => state.toolStates[toolId]?.enabled ?? true,
    isToolVisible: (toolId) => state.toolStates[toolId]?.visible ?? true,
    
    // Tool Definition Management
    registerTool,
    unregisterTool,
    updateTool,
    getTool,
    getTools,
    getToolsByCategory,
    
    // Action Definition Management
    registerAction,
    unregisterAction,
    updateAction,
    getAction,
    getActions,
    
    // Toolbar Configuration Management
    createToolbar,
    deleteToolbar,
    updateToolbar: async (toolbarId, updates) => { 
      setState(prev => ({ ...prev, toolbars: { ...prev.toolbars, [toolbarId]: { ...prev.toolbars[toolbarId], ...updates } } }));
      return { success: true, operation: 'update-toolbar', toolbarId };
    },
    getToolbar,
    getToolbars,
    getVisibleToolbars,
    
    // Toolbar Visibility and State (basic implementations)
    showToolbar: (toolbarId) => setState(prev => ({ ...prev, toolbars: { ...prev.toolbars, [toolbarId]: { ...prev.toolbars[toolbarId], visible: true } } })),
    hideToolbar: (toolbarId) => setState(prev => ({ ...prev, toolbars: { ...prev.toolbars, [toolbarId]: { ...prev.toolbars[toolbarId], visible: false } } })),
    toggleToolbar: (toolbarId) => setState(prev => ({ ...prev, toolbars: { ...prev.toolbars, [toolbarId]: { ...prev.toolbars[toolbarId], visible: !prev.toolbars[toolbarId].visible } } })),
    collapseToolbar: (toolbarId) => setState(prev => ({ ...prev, toolbars: { ...prev.toolbars, [toolbarId]: { ...prev.toolbars[toolbarId], collapsed: true } } })),
    expandToolbar: (toolbarId) => setState(prev => ({ ...prev, toolbars: { ...prev.toolbars, [toolbarId]: { ...prev.toolbars[toolbarId], collapsed: false } } })),
    moveToolbar: (toolbarId, newPosition) => setState(prev => ({
      ...prev,
      toolbars: {
        ...prev.toolbars,
        [toolbarId]: {
          ...prev.toolbars[toolbarId],
          position: newPosition
        }
      }
    })),

    // Tool States Management
    setToolState: (toolId, toolState) => setState(prev => ({ ...prev, toolStates: { ...prev.toolStates, [toolId]: { ...prev.toolStates[toolId], ...toolState } } })),
    getToolState: (toolId) => state.toolStates[toolId] || { active: false, enabled: true, visible: true },
    enableTool: (toolId) => setState(prev => ({ ...prev, toolStates: { ...prev.toolStates, [toolId]: { ...prev.toolStates[toolId], enabled: true } } })),
    disableTool: (toolId) => setState(prev => ({ ...prev, toolStates: { ...prev.toolStates, [toolId]: { ...prev.toolStates[toolId], enabled: false } } })),
    showTool: (toolId) => setState(prev => ({ ...prev, toolStates: { ...prev.toolStates, [toolId]: { ...prev.toolStates[toolId], visible: true } } })),
    hideTool: (toolId) => setState(prev => ({ ...prev, toolStates: { ...prev.toolStates, [toolId]: { ...prev.toolStates[toolId], visible: false } } })),
    
    // Action States Management
    setActionState: (actionId, actionState) => setState(prev => ({ ...prev, actionStates: { ...prev.actionStates, [actionId]: { ...prev.actionStates[actionId], ...actionState } } })),
    getActionState: (actionId) => state.actionStates[actionId] || { enabled: true, visible: true },
    enableAction: (actionId) => setState(prev => ({ ...prev, actionStates: { ...prev.actionStates, [actionId]: { ...prev.actionStates[actionId], enabled: true } } })),
    disableAction: (actionId) => setState(prev => ({ ...prev, actionStates: { ...prev.actionStates, [actionId]: { ...prev.actionStates[actionId], enabled: false } } })),
    showAction: (actionId) => setState(prev => ({ ...prev, actionStates: { ...prev.actionStates, [actionId]: { ...prev.actionStates[actionId], visible: true } } })),
    hideAction: (actionId) => setState(prev => ({ ...prev, actionStates: { ...prev.actionStates, [actionId]: { ...prev.actionStates[actionId], visible: false } } })),
    
    // Tool Runner Functions
    startTool,
    cancelTool,
    completeTool,
    addToolInput,
    removeLastInput,
    clearToolInputs,
    getToolProgress,
    
    // Hotkey Management
    registerHotkey,
    unregisterHotkey,
    executeHotkey,
    getHotkeys,
    
    // Customization (basic implementations)
    addCustomization: (customization) => setState(prev => ({ ...prev, customizations: [...prev.customizations, customization] })),
    removeCustomization: (customizationId) => setState(prev => ({ ...prev, customizations: prev.customizations.filter(c => c.id !== customizationId) })),
    applyCustomization: (customizationId) => {
      const customization = state.customizations.find(c => c.id === customizationId);
      if (customization && customization.changes) {
        // ✅ ENTERPRISE FIX: Use changes instead of config, apply modifiedProperties
        setState(prev => ({
          ...prev,
          toolbars: { ...prev.toolbars, ...customization.changes.modifiedProperties },
        }));
      }
    },
    getCustomizations: () => state.customizations,
    exportCustomizations: () => JSON.stringify(state.customizations),
    importCustomizations: async () => ({ success: false, operation: 'import-config', error: 'Not implemented' }),
    
    // Settings Management
    updateSettings,
    resetSettings,
    getSettings,
    
    // Layout and Positioning (basic implementations)
    getToolbarLayout: () => null, // TODO: Implement
    optimizeLayout: () => {}, // TODO: Implement
    resetLayout: () => {}, // TODO: Implement
    
    // Event Management
    addEventListener: (event, callback) => setEventListeners(prev => ({ ...prev, [event]: callback })),
    removeEventListener: (event) => setEventListeners(prev => { const { [event]: removed, ...remaining } = prev; return remaining; }),
    
    // Utility Functions
    searchTools,
    getToolTooltip,
    isToolbarDocked: () => true, // TODO: Implement
    canExecuteTool: (toolId) => state.toolStates[toolId]?.enabled ?? true,
    
    // Export/Import (basic implementations)
    exportConfiguration: () => JSON.stringify({ toolbars: state.toolbars, tools: state.tools, actions: state.actions, settings: state.settings }),
    importConfiguration: async () => ({ success: false, operation: 'import-config', error: 'Not implemented' }),
    resetToDefaults: () => setState(prev => ({ ...prev, settings: { ...DEFAULT_TOOLBAR_SETTINGS } }))
  }), Object.values(params));
}