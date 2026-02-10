import { useCallback } from 'react';
import { createModuleLogger } from '@/lib/telemetry';
const logger = createModuleLogger('useReadonlyGuards');

export function useReadonlyGuards(isReadOnly: boolean) {
  
  const preventReadOnlyActions = useCallback((action: string) => {
    if (isReadOnly) {
      logger.warn(`Action '${action}' prevented: Canvas is in read-only mode`);
      return true;
    }
    return false;
  }, [isReadOnly]);

  const checkReadOnlyMode = useCallback(() => {
    return isReadOnly;
  }, [isReadOnly]);

  const withReadOnlyCheck = useCallback(<T extends unknown[]>(
    callback: (...args: T) => void,
    actionName: string = 'action'
  ) => {
    return (...args: T) => {
      if (!preventReadOnlyActions(actionName)) {
        callback(...args);
      }
    };
  }, [preventReadOnlyActions]);

  return {
    preventReadOnlyActions,
    checkReadOnlyMode,
    withReadOnlyCheck
  };
}
