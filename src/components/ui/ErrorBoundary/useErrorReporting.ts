// ============================================================================
// 🏢 ENTERPRISE: useErrorReporting Hook
// ============================================================================
// Manual error reporting hook wrapping the ErrorTracker service.
// Provides direct access to error capture, network error, and performance methods.
// @pattern Google — Centralized error reporting interface
// ============================================================================

import { errorTracker, type MetadataRecord } from '@/services/ErrorTracker';
import { createModuleLogger } from '@/lib/telemetry';
import { nowISO } from '@/lib/date-local';

const logger = createModuleLogger('useErrorReporting');

export function useErrorReporting() {
  return {
    reportError: (error: Error, context?: Record<string, unknown>) => {
      const errorId = errorTracker.captureError(
        error,
        'error',
        'user',
        {
          component: 'Manual Error Report',
          action: 'useErrorReporting Hook',
          metadata: {
            ...context,
            manual: true,
            hookUsage: true,
          },
        }
      );

      const errorReport = {
        errorId,
        message: error.message,
        stack: error.stack,
        context,
        timestamp: nowISO(),
        url: window.location.href,
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'SSR',
      };

      logger.error('Manual error report', { errorId: errorReport.errorId, message: errorReport.message });
      return errorId;
    },

    captureUserError: (message: string, action: string, metadata?: MetadataRecord) => {
      return errorTracker.captureUserError(message, action, metadata);
    },

    captureNetworkError: (url: string, status: number, statusText: string, method?: string) => {
      return errorTracker.captureNetworkError(url, status, statusText, method);
    },

    capturePerformanceIssue: (metric: string, value: number, threshold: number) => {
      return errorTracker.capturePerformanceIssue(metric, value, threshold);
    },

    getErrorStats: () => errorTracker.getStats(),
    clearErrors: () => errorTracker.clearErrors(),
  };
}
