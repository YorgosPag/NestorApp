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
  ToolbarSettings,
  ToolbarPosition,
  ActionParameters,
  ToolParameters,
  ToolExecutionResult,
  ToolInput
} from '../config';
import { DEFAULT_TOOLBAR_SETTINGS } from '../config';
import { ToolbarSystemUtils } from '../utils';
import type { ToolbarsContextType } from '../ToolbarsContext.types';

type ContextValueParams = {
  state: ToolbarState;
  toolRunner: ToolRunner;
  setState: React.Dispatch<React.SetStateAction<ToolbarState>>;
  setEventListeners: React.Dispatch<React.SetStateAction<Partial<ToolEvents>>>;
  activateTool: (toolId: ToolType) => void;
  deactivateTool: (toolId?: ToolType) => void;
  toggleTool: (toolId: ToolType) => void;
  executeAction: (actionId: string, parameters?: ActionParameters) => void;
  registerTool: (tool: ToolDefinition) => void;
  unregisterTool: (toolId: ToolType) => void;
  updateTool: (toolId: ToolType, updates: Partial<ToolDefinition>) => void;
  getTool: (toolId: ToolType) => ToolDefinition | undefined;
  getTools: () => Partial<Record<ToolType, ToolDefinition>>;
  getToolsByCategory: (category: string) => ToolDefinition[];
  registerAction: (action: ActionDefinition) => void;
  unregisterAction: (actionId: string) => void;
  updateAction: (actionId: string, updates: Partial<ActionDefinition>) => void;
  getAction: (actionId: string) => ActionDefinition | undefined;
  getActions: () => Record<string, ActionDefinition>;
  createToolbar: (config: ToolbarConfig) => Promise<ToolbarOperationResult>;
  deleteToolbar: (toolbarId: string) => Promise<ToolbarOperationResult>;
  getToolbar: (toolbarId: string) => ToolbarConfig | undefined;
  getToolbars: () => Record<string, ToolbarConfig>;
  getVisibleToolbars: () => ToolbarConfig[];
  startTool: (toolId: ToolType, parameters?: ToolParameters) => void;
  cancelTool: () => void;
  completeTool: (result?: ToolExecutionResult) => void;
  addToolInput: (input: ToolInput) => void;
  removeLastInput: () => void;
  clearToolInputs: () => void;
  getToolProgress: () => { current: number; total: number; percentage: number };
  registerHotkey: (hotkey: string, toolId: ToolType) => void;
  unregisterHotkey: (hotkey: string) => void;
  executeHotkey: (hotkey: string) => void;
  getHotkeys: () => Record<string, ToolType>;
  updateSettings: (updates: Partial<ToolbarSettings>) => void;
  resetSettings: () => void;
  getSettings: () => ToolbarSettings;
  searchTools: (query: string) => ToolDefinition[];
  getToolTooltip: (toolId: ToolType) => string;
};

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
    moveToolbar: (toolbarId, newPosition: ToolbarPosition) => setState((prev: ToolbarState) => ({
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
      if (!customization) return;

      setState((prev: ToolbarState) => {
        const targetToolbar = prev.toolbars[customization.toolbarId];
        if (!targetToolbar) {
          return prev;
        }

        const updatedToolbar = ToolbarSystemUtils.applyCustomization(targetToolbar, customization);
        return {
          ...prev,
          toolbars: { ...prev.toolbars, [customization.toolbarId]: updatedToolbar }
        };
      });
    },
    getCustomizations: () => state.customizations,
    exportCustomizations: () => JSON.stringify(state.customizations),
    importCustomizations: async () => ({ success: false, operation: 'import-config', error: 'Not implemented' }),
    
    // Settings Management
    updateSettings,
    resetSettings,
    getSettings,
    
    // Layout and Positioning (basic implementations)
    getToolbarLayout: () => undefined, // TODO: Implement
    optimizeLayout: () => {}, // TODO: Implement
    resetLayout: () => {}, // TODO: Implement
    
    // Event Management
    addEventListener: (event, callback) => setEventListeners(prev => ({ ...prev, [event]: callback })),
    removeEventListener: (event) => setEventListeners((prev: Partial<ToolEvents>) => { const { [event]: removed, ...remaining } = prev; return remaining; }),
    
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
