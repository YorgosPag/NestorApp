import { useCallback, useEffect, useState } from 'react';
import type { ToolType, ToolbarState, ToolbarSettings, ToolEvents } from '../config';
import { DEFAULT_TOOLBAR_SETTINGS } from '../config';
import { ToolbarSystemUtils } from '../utils';

interface UtilityManagementParams {
  state: ToolbarState;
  setState: React.Dispatch<React.SetStateAction<ToolbarState>>;
  activateTool: (toolId: ToolType) => void;
  eventListeners: ToolEvents;
}

export function useUtilityManagement({
  state,
  setState,
  activateTool,
  eventListeners
}: UtilityManagementParams) {

  // ===== HOTKEY MANAGEMENT =====
  const [hotkeys, setHotkeys] = useState<Record<string, ToolType>>({});

  const registerHotkey = useCallback((hotkey: string, toolId: ToolType) => {
    setHotkeys(prev => ({ ...prev, [hotkey]: toolId }));
  }, []);

  const unregisterHotkey = useCallback((hotkey: string) => {
    setHotkeys(prev => {
      const { [hotkey]: removed, ...remaining } = prev;
      return remaining;
    });
  }, []);

  const executeHotkey = useCallback((hotkey: string) => {
    const toolId = hotkeys[hotkey];
    if (toolId && state.tools[toolId]?.enabled) {
      activateTool(toolId);
      eventListeners.onHotkeyPressed?.(hotkey, toolId);
    }
  }, [hotkeys, state.tools, activateTool, eventListeners]);

  const getHotkeys = useCallback(() => hotkeys, [hotkeys]);

  // ===== SETTINGS MANAGEMENT =====
  const updateSettings = useCallback((updates: Partial<ToolbarSettings>) => {
    setState(prev => ({
      ...prev,
      settings: { ...prev.settings, ...updates }
    }));
  }, [setState]);

  const resetSettings = useCallback(() => {
    setState(prev => ({
      ...prev,
      settings: { ...DEFAULT_TOOLBAR_SETTINGS }
    }));
  }, [setState]);

  const getSettings = useCallback(() => state.settings, [state.settings]);

  // ===== UTILITY FUNCTIONS =====
  const searchTools = useCallback((query: string) => {
    return ToolbarSystemUtils.searchTools(state.tools, query);
  }, [state.tools]);

  const getToolTooltip = useCallback((toolId: ToolType) => {
    const tool = state.tools[toolId];
    return tool?.tooltip || tool?.label || toolId;
  }, [state.tools]);

  // ===== EFFECTS =====
  useEffect(() => {
    // Initialize default tools and hotkeys
    Object.entries(state.tools).forEach(([toolId, tool]) => {
      if (tool.hotkey) {
        registerHotkey(tool.hotkey, toolId as ToolType);
      }
    });
  }, [state.tools, registerHotkey]);

  return {
    // Hotkey Management
    registerHotkey,
    unregisterHotkey,
    executeHotkey,
    getHotkeys,
    
    // Settings Management  
    updateSettings,
    resetSettings,
    getSettings,
    
    // Utility Functions
    searchTools,
    getToolTooltip
  };
}