/**
 * TOOLBARS SYSTEM HOOK
 * Standalone hook for accessing toolbars context and tool runner utilities
 */

import { useContext } from 'react';
import type { ToolbarsContextType } from './ToolbarsContext.types';
import { ToolbarsContext } from './ToolbarsSystem';

export function useToolbars(): ToolbarsContextType {
  const context = useContext(ToolbarsContext);
  if (!context) {
    throw new Error('useToolbars must be used within a ToolbarsSystem');
  }
  return context;
}

// Additional convenience hooks
export function useActiveTool() {
  const toolbars = useToolbars();
  return {
    activeTool: toolbars.state.activeTool,
    isActive: toolbars.getActiveTool() !== null,
    activateTool: toolbars.activateTool,
    deactivateTool: toolbars.deactivateTool,
    toggleTool: toolbars.toggleTool
  };
}

export function useToolRunner() {
  const toolbars = useToolbars();
  return {
    runner: toolbars.toolRunner,
    startTool: toolbars.startTool,
    cancelTool: toolbars.cancelTool,
    completeTool: toolbars.completeTool,
    addInput: toolbars.addToolInput,
    removeLastInput: toolbars.removeLastInput,
    clearInputs: toolbars.clearToolInputs,
    progress: toolbars.getToolProgress()
  };
}

export function useToolbarConfig() {
  const toolbars = useToolbars();
  return {
    toolbars: toolbars.state.toolbars,
    createToolbar: toolbars.createToolbar,
    deleteToolbar: toolbars.deleteToolbar,
    updateToolbar: toolbars.updateToolbar,
    getToolbar: toolbars.getToolbar,
    getVisibleToolbars: toolbars.getVisibleToolbars,
    showToolbar: toolbars.showToolbar,
    hideToolbar: toolbars.hideToolbar,
    toggleToolbar: toolbars.toggleToolbar
  };
}

export function useToolDefinitions() {
  const toolbars = useToolbars();
  return {
    tools: toolbars.state.tools,
    actions: toolbars.state.actions,
    registerTool: toolbars.registerTool,
    unregisterTool: toolbars.unregisterTool,
    updateTool: toolbars.updateTool,
    getTool: toolbars.getTool,
    getTools: toolbars.getTools,
    getToolsByCategory: toolbars.getToolsByCategory,
    registerAction: toolbars.registerAction,
    unregisterAction: toolbars.unregisterAction,
    getAction: toolbars.getAction,
    getActions: toolbars.getActions
  };
}

export function useToolStates() {
  const toolbars = useToolbars();
  return {
    toolStates: toolbars.state.toolStates,
    actionStates: toolbars.state.actionStates,
    setToolState: toolbars.setToolState,
    getToolState: toolbars.getToolState,
    setActionState: toolbars.setActionState,
    getActionState: toolbars.getActionState,
    enableTool: toolbars.enableTool,
    disableTool: toolbars.disableTool,
    isToolEnabled: toolbars.isToolEnabled,
    isToolVisible: toolbars.isToolVisible
  };
}

export function useHotkeys() {
  const toolbars = useToolbars();
  return {
    registerHotkey: toolbars.registerHotkey,
    unregisterHotkey: toolbars.unregisterHotkey,
    executeHotkey: toolbars.executeHotkey,
    getHotkeys: toolbars.getHotkeys
  };
}

export function useToolbarCustomization() {
  const toolbars = useToolbars();
  return {
    customizations: toolbars.state.customizations,
    addCustomization: toolbars.addCustomization,
    removeCustomization: toolbars.removeCustomization,
    applyCustomization: toolbars.applyCustomization,
    getCustomizations: toolbars.getCustomizations,
    exportCustomizations: toolbars.exportCustomizations,
    importCustomizations: toolbars.importCustomizations
  };
}

export function useToolbarSettings() {
  const toolbars = useToolbars();
  return {
    settings: toolbars.state.settings,
    updateSettings: toolbars.updateSettings,
    resetSettings: toolbars.resetSettings,
    getSettings: toolbars.getSettings
  };
}

// Legacy hook names for backward compatibility
export const useToolbar = useToolbars;
export const useTools = useToolbars;
export const useToolSystem = useToolbars;
