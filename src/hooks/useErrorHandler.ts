import { useCallback } from 'react';
import { useTranslation } from '@/i18n';
import { useNotifications } from '@/providers/NotificationProvider';
import { mapErrorToI18n, mapHttpStatusToError, type DomainError } from '@/lib/error-mapping';

/**
 * Centralized error handling hook
 * Converts domain errors to localized toast notifications
 */
export function useErrorHandler() {
  const { t } = useTranslation();
  const notifications = useNotifications();

  /**
   * Handle domain error with automatic i18n mapping
   */
  const handleError = useCallback((error: DomainError | Error | string) => {
    let domainError: DomainError;

    // Convert different error types to DomainError
    if (typeof error === 'string') {
      domainError = { code: 'GENERIC_ERROR', context: { message: error } };
    } else if (error instanceof Error) {
      domainError = { 
        code: 'JAVASCRIPT_ERROR', 
        context: { message: error.message, stack: error.stack } 
      };
    } else {
      domainError = error;
    }

    // Map to i18n configuration
    const mapping = mapErrorToI18n(domainError);
    
    // Get localized message
    const message = mapping.namespace 
      ? t(`${mapping.namespace}:${mapping.key}`, mapping.context)
      : t(mapping.key, mapping.context);

    // Show error notification
    notifications.error(`❌ ${t('errors:general.error', 'Σφάλμα')}: ${message || mapping.fallback}`);

    // Log for debugging in development
    if (process.env.NODE_ENV === 'development') {
      console.error('Domain Error:', domainError);
      console.log('i18n Mapping:', mapping);
      console.log('Localized Message:', message);
    }
  }, [t, notifications]);

  /**
   * Handle HTTP response errors
   */
  const handleHttpError = useCallback((response: Response, data?: any) => {
    const domainError = mapHttpStatusToError(response.status, data);
    handleError(domainError);
  }, [handleError]);

  /**
   * Handle async operation errors with automatic error boundaries
   */
  const handleAsyncError = useCallback(async <T>(
    operation: () => Promise<T>,
    errorContext?: Record<string, any>
  ): Promise<T | null> => {
    try {
      return await operation();
    } catch (error) {
      const domainError: DomainError = {
        code: 'ASYNC_OPERATION_FAILED',
        domain: 'APP',
        context: { ...errorContext, originalError: error },
      };
      handleError(domainError);
      return null;
    }
  }, [handleError]);

  /**
   * Create error handler for specific domain
   */
  const createDomainErrorHandler = useCallback((domain: string) => {
    return (code: string, context?: Record<string, any>) => {
      handleError({ code, domain, context });
    };
  }, [handleError]);

  return {
    handleError,
    handleHttpError,
    handleAsyncError,
    createDomainErrorHandler,
  };
}