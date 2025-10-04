import { useCallback } from 'react';
import type { ToolType, ToolRunner, ToolEvents } from '../config';
import { ToolbarSystemUtils } from '../utils';

interface ToolRunnerManagementParams {
  toolRunner: ToolRunner;
  setToolRunner: React.Dispatch<React.SetStateAction<ToolRunner>>;
  activateTool: (toolId: ToolType) => void;
  deactivateTool: (toolId?: ToolType) => void;
  eventListeners: ToolEvents;
}

export function useToolRunnerManagement({
  toolRunner,
  setToolRunner,
  activateTool,
  deactivateTool,
  eventListeners
}: ToolRunnerManagementParams) {

  // ===== TOOL RUNNER FUNCTIONS =====
  const startTool = useCallback((toolId: ToolType, parameters?: any) => {
    activateTool(toolId);
    
    setToolRunner(prev => ({
      ...prev,
      currentTool: toolId,
      isActive: true,
      inputPoints: [],
      stepIndex: 0,
      previewData: null
    }));

    eventListeners.onToolExecute?.(toolId, parameters);
  }, [activateTool, eventListeners, setToolRunner]);

  const cancelTool = useCallback(() => {
    const currentTool = toolRunner.currentTool;
    
    setToolRunner(ToolbarSystemUtils.createToolRunner());
    
    if (currentTool) {
      deactivateTool(currentTool);
      eventListeners.onToolCancel?.(currentTool);
    }
  }, [toolRunner.currentTool, deactivateTool, eventListeners, setToolRunner]);

  const completeTool = useCallback((result?: any) => {
    const currentTool = toolRunner.currentTool;
    
    if (currentTool) {
      eventListeners.onToolComplete?.(currentTool, result);
    }
    
    setToolRunner(ToolbarSystemUtils.createToolRunner());
    deactivateTool(currentTool || undefined);
  }, [toolRunner.currentTool, eventListeners, deactivateTool, setToolRunner]);

  const addToolInput = useCallback((input: any) => {
    setToolRunner(prev => ({
      ...prev,
      inputPoints: [...prev.inputPoints, input]
    }));
  }, [setToolRunner]);

  const removeLastInput = useCallback(() => {
    setToolRunner(prev => ({
      ...prev,
      inputPoints: prev.inputPoints.slice(0, -1)
    }));
  }, [setToolRunner]);

  const clearToolInputs = useCallback(() => {
    setToolRunner(prev => ({
      ...prev,
      inputPoints: []
    }));
  }, [setToolRunner]);

  const getToolProgress = useCallback(() => {
    return ToolbarSystemUtils.calculateProgress(toolRunner);
  }, [toolRunner]);

  return {
    startTool,
    cancelTool,
    completeTool,
    addToolInput,
    removeLastInput,
    clearToolInputs,
    getToolProgress
  };
}