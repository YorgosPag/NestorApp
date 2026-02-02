import { useCallback } from 'react';
import type { ToolType, ToolRunner, ToolEvents, ActionParameters, ToolExecutionResult, ToolInput } from '../config';
import { ToolbarSystemUtils } from '../utils';

interface ToolRunnerManagementParams {
  toolRunner: ToolRunner;
  setToolRunner: React.Dispatch<React.SetStateAction<ToolRunner>>;
  activateTool: (toolId: ToolType) => void;
  deactivateTool: (toolId?: ToolType) => void;
  eventListeners: Partial<ToolEvents>;
}

export function useToolRunnerManagement({
  toolRunner,
  setToolRunner,
  activateTool,
  deactivateTool,
  eventListeners
}: ToolRunnerManagementParams) {

  // ===== TOOL RUNNER FUNCTIONS =====
  const startTool = useCallback((toolId: ToolType, parameters?: ActionParameters) => {
    activateTool(toolId);
    
    setToolRunner(prev => ({
      ...prev,
      currentTool: toolId,
      isActive: true,
      inputPoints: [],
      stepIndex: 0,
      previewData: null
    }));

    eventListeners.onToolExecute?.(toolId, parameters as ActionParameters);
  }, [activateTool, eventListeners, setToolRunner]);

  const cancelTool = useCallback(() => {
    const currentTool = toolRunner.currentTool;
    
    setToolRunner(ToolbarSystemUtils.createToolRunner());
    
    if (currentTool) {
      deactivateTool(currentTool);
      eventListeners.onToolCancel?.(currentTool);
    }
  }, [toolRunner.currentTool, deactivateTool, eventListeners, setToolRunner]);

  const completeTool = useCallback((result?: ToolExecutionResult) => {
    const currentTool = toolRunner.currentTool;
    
    if (currentTool) {
      eventListeners.onToolComplete?.(currentTool, result as ToolExecutionResult);
    }
    
    setToolRunner(ToolbarSystemUtils.createToolRunner());
    deactivateTool(currentTool || undefined);
  }, [toolRunner.currentTool, eventListeners, deactivateTool, setToolRunner]);

  const addToolInput = useCallback((input: ToolInput) => {
    setToolRunner((prev: ToolRunner) => ({
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
