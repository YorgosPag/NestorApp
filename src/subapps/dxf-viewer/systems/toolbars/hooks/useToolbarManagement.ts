import { useCallback } from 'react';
import type { ToolbarConfig, ToolbarOperationResult, ToolbarState } from '../config';
import { ToolbarSystemUtils } from '../utils';

interface ToolbarManagementParams {
  state: ToolbarState;
  setState: React.Dispatch<React.SetStateAction<ToolbarState>>;
  onError?: (error: string) => void;
}

export function useToolbarManagement({
  state,
  setState,
  onError
}: ToolbarManagementParams) {

  // ===== TOOLBAR CONFIGURATION MANAGEMENT =====
  const createToolbar = useCallback(async (config: ToolbarConfig): Promise<ToolbarOperationResult> => {
    const handleError = ToolbarSystemUtils.createErrorHandler(onError);
    const safeUpdate = ToolbarSystemUtils.createSafeStateUpdater(setState, onError);
    
    try {
      const validation = ToolbarSystemUtils.validateToolbarConfig(config);
      if (!validation.valid) {
        return ToolbarSystemUtils.createOperationResult(
          'create-toolbar',
          false,
          undefined,
          validation.errors.join(', '),
          config.id
        );
      }

      safeUpdate(prev => ({
        ...prev,
        toolbars: { ...prev.toolbars, [config.id]: config }
      }), 'create toolbar');

      return ToolbarSystemUtils.createOperationResult(
        'create-toolbar',
        true,
        config,
        undefined,
        config.id
      );
    } catch (error) {
      const errorMsg = handleError('create toolbar', error);
      return ToolbarSystemUtils.createOperationResult(
        'create-toolbar',
        false,
        undefined,
        errorMsg,
        config.id
      );
    }
  }, [onError, setState]);

  const deleteToolbar = useCallback(async (toolbarId: string): Promise<ToolbarOperationResult> => {
    const handleError = ToolbarSystemUtils.createErrorHandler(onError);
    const safeUpdate = ToolbarSystemUtils.createSafeStateUpdater(setState, onError);

    try {
      safeUpdate(prev => {
        const { [toolbarId]: removedToolbar, ...remainingToolbars } = prev.toolbars;
        return {
          ...prev,
          toolbars: remainingToolbars,
          activeToolbar: prev.activeToolbar === toolbarId ? null : prev.activeToolbar
        };
      }, 'delete toolbar');

      return ToolbarSystemUtils.createOperationResult(
        'delete-toolbar',
        true,
        undefined,
        undefined,
        toolbarId
      );
    } catch (error) {
      const errorMsg = handleError('delete toolbar', error);
      return ToolbarSystemUtils.createOperationResult(
        'delete-toolbar',
        false,
        undefined,
        errorMsg,
        toolbarId
      );
    }
  }, [onError, setState]);

  // Utility functions
  const getToolbar = useCallback((toolbarId: string) => state.toolbars[toolbarId], [state.toolbars]);
  const getToolbars = useCallback(() => state.toolbars, [state.toolbars]);
  const getVisibleToolbars = useCallback(() => 
    Object.values(state.toolbars).filter(toolbar => toolbar.visible),
    [state.toolbars]
  );

  return {
    createToolbar,
    deleteToolbar,
    getToolbar,
    getToolbars,
    getVisibleToolbars
  };
}