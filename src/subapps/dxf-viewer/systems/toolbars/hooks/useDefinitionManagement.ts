import { useCallback } from 'react';
import type { ToolType, ToolDefinition, ActionDefinition, ToolbarState } from '../config';
import { ToolbarSystemUtils } from '../utils';

interface DefinitionManagementParams {
  state: ToolbarState;
  setState: React.Dispatch<React.SetStateAction<ToolbarState>>;
  onError?: (error: string) => void;
}

export function useDefinitionManagement({
  state,
  setState,
  onError
}: DefinitionManagementParams) {

  // ===== TOOL DEFINITION MANAGEMENT =====
  const registerTool = useCallback((tool: ToolDefinition) => {
    const validation = ToolbarSystemUtils.validateToolDefinition(tool);
    if (!validation.valid) {
      onError?.(validation.errors.join(', '));
      return;
    }

    setState(prev => ({
      ...prev,
      tools: { ...prev.tools, [tool.id]: tool },
      toolStates: {
        ...prev.toolStates,
        [tool.id]: {
          active: false,
          enabled: tool.enabled,
          visible: tool.visible
        }
      }
    }));
  }, [onError, setState]);

  const unregisterTool = useCallback((toolId: ToolType) => {
    setState((prev): ToolbarState => {
      const { [toolId]: removedTool, ...remainingTools } = prev.tools;
      const { [toolId]: removedState, ...remainingStates } = prev.toolStates;

      return {
        ...prev,
        tools: remainingTools,
        toolStates: remainingStates,
        activeTool: prev.activeTool === toolId ? null : prev.activeTool
      };
    });
  }, [setState]);

  const updateTool = useCallback((toolId: ToolType, updates: Partial<ToolDefinition>) => {
    setState(prev => ({
      ...prev,
      tools: {
        ...prev.tools,
        [toolId]: { ...prev.tools[toolId], ...updates }
      }
    }));
  }, [setState]);

  const getTool = useCallback((toolId: ToolType) => state.tools[toolId], [state.tools]);
  const getTools = useCallback(() => state.tools, [state.tools]);
  
  const getToolsByCategory = useCallback((category: string) => 
    Object.values(state.tools)
      .filter((tool): tool is ToolDefinition => Boolean(tool))
      .filter(tool => tool.category === category),
    [state.tools]
  );

  // ===== ACTION DEFINITION MANAGEMENT =====
  const registerAction = useCallback((action: ActionDefinition) => {
    const validation = ToolbarSystemUtils.validateActionDefinition(action);
    if (!validation.valid) {
      onError?.(validation.errors.join(', '));
      return;
    }

    setState(prev => ({
      ...prev,
      actions: { ...prev.actions, [action.id]: action },
      actionStates: {
        ...prev.actionStates,
        [action.id]: {
          enabled: action.enabled,
          visible: action.visible,
          checked: false
        }
      }
    }));
  }, [onError, setState]);

  const unregisterAction = useCallback((actionId: string) => {
    setState(prev => {
      const { [actionId]: removedAction, ...remainingActions } = prev.actions;
      const { [actionId]: removedState, ...remainingStates } = prev.actionStates;
      
      return {
        ...prev,
        actions: remainingActions,
        actionStates: remainingStates
      };
    });
  }, [setState]);

  const updateAction = useCallback((actionId: string, updates: Partial<ActionDefinition>) => {
    setState(prev => ({
      ...prev,
      actions: {
        ...prev.actions,
        [actionId]: { ...prev.actions[actionId], ...updates }
      }
    }));
  }, [setState]);

  const getAction = useCallback((actionId: string) => state.actions[actionId], [state.actions]);
  const getActions = useCallback(() => state.actions, [state.actions]);

  return {
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
    getActions
  };
}
