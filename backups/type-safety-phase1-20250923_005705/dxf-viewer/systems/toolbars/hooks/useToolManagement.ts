import { useCallback } from 'react';
import type { ToolType, ToolbarState, ToolRunner } from '../config';
import { ToolbarSystemUtils } from '../utils';

interface ToolManagementParams {
  state: ToolbarState;
  setState: React.Dispatch<React.SetStateAction<ToolbarState>>;
  toolRunner: ToolRunner;
  setToolRunner: React.Dispatch<React.SetStateAction<ToolRunner>>;
  eventListeners: any;
  onToolChange?: (toolId: ToolType | null) => void;
  onError?: (error: string) => void;
}

export function useToolManagement({
  state,
  setState,
  toolRunner,
  setToolRunner,
  eventListeners,
  onToolChange,
  onError
}: ToolManagementParams) {
  
  const activateTool = useCallback((toolId: ToolType) => {
    // Deactivate current tool if exclusive
    if (state.activeTool && state.tools[state.activeTool]?.exclusive) {
      deactivateTool(state.activeTool);
    }

    setState(prev => ({
      ...prev,
      activeTool: toolId,
      toolStates: {
        ...prev.toolStates,
        [toolId]: { ...prev.toolStates[toolId], active: true }
      }
    }));

    // Update tool runner if tool requires input
    const tool = state.tools[toolId];
    if (tool?.requiresInput) {
      setToolRunner(prev => ({
        ...prev,
        currentTool: toolId,
        isActive: true,
        stepIndex: 0,
        inputPoints: []
      }));
    }

    // Trigger event
    eventListeners.onToolActivate?.(toolId);
    onToolChange?.(toolId);
  }, [state.activeTool, state.tools, eventListeners, onToolChange, setState, setToolRunner]);

  const deactivateTool = useCallback((toolId?: ToolType) => {
    const targetTool = toolId || state.activeTool;
    if (!targetTool) return;

    setState(prev => ({
      ...prev,
      activeTool: prev.activeTool === targetTool ? null : prev.activeTool,
      toolStates: {
        ...prev.toolStates,
        [targetTool]: { ...prev.toolStates[targetTool], active: false }
      }
    }));

    // Reset tool runner
    if (toolRunner.currentTool === targetTool) {
      setToolRunner(ToolbarSystemUtils.createToolRunner());
    }

    // Trigger event
    eventListeners.onToolDeactivate?.(targetTool);
    if (state.activeTool === targetTool) {
      onToolChange?.(null);
    }
  }, [state.activeTool, toolRunner.currentTool, eventListeners, onToolChange, setState, setToolRunner]);

  const toggleTool = useCallback((toolId: ToolType) => {
    if (state.activeTool === toolId) {
      deactivateTool(toolId);
    } else {
      activateTool(toolId);
    }
  }, [state.activeTool, activateTool, deactivateTool]);

  const executeAction = useCallback((actionId: string, parameters?: any) => {
    const action = state.actions[actionId];
    if (!action || !action.enabled) return;

    try {
      // Execute based on action type
      switch (action.type) {
        case 'tool':
          if (action.command && action.command in state.tools) {
            activateTool(action.command as ToolType);
          }
          break;
        case 'command':
          // Execute command with parameters
          eventListeners.onActionExecute?.(actionId, parameters);
          break;
        case 'toggle':
          // Toggle action state
          setState(prev => ({
            ...prev,
            actionStates: {
              ...prev.actionStates,
              [actionId]: {
                ...prev.actionStates[actionId],
                checked: !prev.actionStates[actionId]?.checked
              }
            }
          }));
          break;
      }
    } catch (error) {
      onError?.(`Failed to execute action: ${actionId}`);
    }
  }, [state.actions, state.tools, activateTool, eventListeners, onError, setState]);

  // Utility functions
  const getActiveTool = useCallback(() => state.activeTool, [state.activeTool]);
  const isToolActive = useCallback((toolId: ToolType) => state.activeTool === toolId, [state.activeTool]);
  const isToolEnabled = useCallback((toolId: ToolType) => state.toolStates[toolId]?.enabled ?? true, [state.toolStates]);
  const isToolVisible = useCallback((toolId: ToolType) => state.toolStates[toolId]?.visible ?? true, [state.toolStates]);

  return {
    activateTool,
    deactivateTool,
    toggleTool,
    executeAction,
    getActiveTool,
    isToolActive,
    isToolEnabled,
    isToolVisible
  };
}