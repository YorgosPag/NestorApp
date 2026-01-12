/**
 * Unified notification service with domain error mapping
 * Centralizes all notification logic and provides error code translation
 */

import type { ErrorCodeMapping, NotificationOptions } from '@/types/notifications';

/**
 * Domain-specific error codes mapped to i18n keys
 * Centralizes error handling across the application
 */
export const ERROR_CODE_MAPPING: ErrorCodeMapping = {
  // Authentication errors
  'AUTH_INVALID_CREDENTIALS': {
    i18nKey: 'auth.errors.invalidCredentials',
    type: 'error',
    namespace: 'auth'
  },
  'AUTH_TOKEN_EXPIRED': {
    i18nKey: 'auth.errors.tokenExpired',
    type: 'warning',
    namespace: 'auth'
  },
  'AUTH_INSUFFICIENT_PERMISSIONS': {
    i18nKey: 'auth.errors.insufficientPermissions',
    type: 'error',
    namespace: 'auth'
  },

  // Validation errors
  'VALIDATION_REQUIRED_FIELD': {
    i18nKey: 'forms.validation.required',
    type: 'error',
    namespace: 'forms'
  },
  'VALIDATION_INVALID_EMAIL': {
    i18nKey: 'forms.validation.email',
    type: 'error',
    namespace: 'forms'
  },
  'VALIDATION_PASSWORD_WEAK': {
    i18nKey: 'forms.validation.weakPassword',
    type: 'warning',
    namespace: 'forms'
  },

  // Network errors
  'NETWORK_CONNECTION_FAILED': {
    i18nKey: 'errors.network.connectionFailed',
    type: 'error',
    namespace: 'errors'
  },
  'NETWORK_TIMEOUT': {
    i18nKey: 'errors.network.timeout',
    type: 'error',
    namespace: 'errors'
  },
  'NETWORK_SERVER_ERROR': {
    i18nKey: 'errors.network.serverError',
    type: 'error',
    namespace: 'errors'
  },

  // CRM specific errors
  'CRM_CONTACT_NOT_FOUND': {
    i18nKey: 'crm.errors.contactNotFound',
    type: 'error',
    namespace: 'crm'
  },
  'CRM_OPPORTUNITY_INVALID_STAGE': {
    i18nKey: 'crm.errors.invalidStage',
    type: 'warning',
    namespace: 'crm'
  },
  'CRM_TASK_DEADLINE_PASSED': {
    i18nKey: 'crm.errors.deadlinePassed',
    type: 'warning',
    namespace: 'crm'
  },

  // Properties specific errors
  'PROPERTY_NOT_AVAILABLE': {
    i18nKey: 'properties.errors.notAvailable',
    type: 'warning',
    namespace: 'properties'
  },
  'PROPERTY_PRICE_INVALID': {
    i18nKey: 'properties.errors.invalidPrice',
    type: 'error',
    namespace: 'properties'
  },
  'PROPERTY_ALREADY_RESERVED': {
    i18nKey: 'properties.errors.alreadyReserved',
    type: 'error',
    namespace: 'properties'
  },

  // Building management errors
  'BUILDING_CONSTRUCTION_NOT_STARTED': {
    i18nKey: 'building.errors.constructionNotStarted',
    type: 'info',
    namespace: 'building'
  },
  'BUILDING_PERMITS_MISSING': {
    i18nKey: 'building.errors.permitsMissing',
    type: 'warning',
    namespace: 'building'
  },

  // File upload errors
  'FILE_TOO_LARGE': {
    i18nKey: 'errors.file.tooLarge',
    type: 'error',
    namespace: 'errors'
  },
  'FILE_INVALID_TYPE': {
    i18nKey: 'errors.file.invalidType',
    type: 'error',
    namespace: 'errors'
  },

  // Generic errors
  'GENERIC_UNKNOWN_ERROR': {
    i18nKey: 'errors.generic.unknown',
    type: 'error',
    namespace: 'errors'
  },
  'GENERIC_PERMISSION_DENIED': {
    i18nKey: 'errors.generic.permissionDenied',
    type: 'error',
    namespace: 'errors'
  }
};

/**
 * Success message mapping for positive feedback
 */
export const SUCCESS_MESSAGE_MAPPING = {
  'CONTACT_CREATED': 'crm.success.contactCreated',
  'CONTACT_UPDATED': 'crm.success.contactUpdated',
  'CONTACT_DELETED': 'crm.success.contactDeleted',
  'PROPERTY_SAVED': 'properties.success.saved',
  'PROPERTY_PUBLISHED': 'properties.success.published',
  'BUILDING_STATUS_UPDATED': 'building.success.statusUpdated',
  'AUTH_LOGIN_SUCCESS': 'auth.success.loginSuccess',
  'AUTH_LOGOUT_SUCCESS': 'auth.success.logoutSuccess',
  'FILE_UPLOADED': 'common.success.fileUploaded',
  'SETTINGS_SAVED': 'common.success.settingsSaved'
} as const;

/**
 * Notification service class for centralized notification management
 */
/** Notification handler interface */
interface NotificationHandler {
  error: (message: string, options?: NotificationOptions) => void;
  success: (message: string, options?: NotificationOptions) => void;
  warning: (message: string, options?: NotificationOptions) => void;
  info: (message: string, options?: NotificationOptions) => void;
  loading: (message: string, options?: NotificationOptions) => string;
  dismiss: (id: string) => void;
}

export class NotificationService {
  private static instance: NotificationService;
  private notificationHandler: NotificationHandler | null = null;

  private constructor() {}

  static getInstance(): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService();
    }
    return NotificationService.instance;
  }

  /**
   * Set the notification handler (typically from useNotifications hook)
   */
  setHandler(handler: NotificationHandler) {
    this.notificationHandler = handler;
  }

  /**
   * Show notification by error code with automatic i18n resolution
   */
  showErrorByCode(errorCode: string, variables?: Record<string, unknown>, options?: NotificationOptions) {
    const mapping = ERROR_CODE_MAPPING[errorCode];
    
    if (!mapping) {
      // Warning logging removed
      this.notificationHandler?.error('An unexpected error occurred', options);
      return;
    }

    // Here we would normally use i18n to resolve the key
    // For now, using the key directly (would be resolved in the component)
    this.notificationHandler?.error(mapping.i18nKey, {
      ...options,
      type: mapping.type
    });
  }

  /**
   * Show success notification by code
   */
  showSuccessByCode(successCode: keyof typeof SUCCESS_MESSAGE_MAPPING, variables?: Record<string, any>, options?: NotificationOptions) {
    const i18nKey = SUCCESS_MESSAGE_MAPPING[successCode];
    
    if (!i18nKey) {
      // Warning logging removed
      return;
    }

    this.notificationHandler?.success(i18nKey, options);
  }

  /**
   * Show notification with automatic retry capability
   */
  showWithRetry(message: string, retryAction: () => void, options?: NotificationOptions) {
    this.notificationHandler?.error(message, {
      ...options,
      actions: [
        {
          label: 'Retry',
          onClick: retryAction
        }
      ]
    });
  }

  /**
   * Show batch operation results
   */
  showBatchResults(results: { success: number; failed: number; total: number }) {
    const { success, failed, total } = results;
    
    if (failed === 0) {
      this.notificationHandler?.success(`Successfully processed ${success}/${total} items`);
    } else if (success === 0) {
      this.notificationHandler?.error(`Failed to process ${failed}/${total} items`);
    } else {
      this.notificationHandler?.warning(`Processed ${success}/${total} items. ${failed} failed.`);
    }
  }

  /**
   * Show loading notification that can be updated
   */
  showLoading(message: string, options?: NotificationOptions): string {
    return this.notificationHandler?.loading(message, options) || '';
  }

  /**
   * Update existing notification (useful for loading states)
   */
  updateNotification(id: string, message: string, type: 'success' | 'error' | 'warning' | 'info') {
    // Dismiss old notification
    this.notificationHandler?.dismiss(id);
    
    // Show new one
    return this.notificationHandler?.[type](message);
  }

  /**
   * Show form validation errors
   */
  showValidationErrors(errors: Record<string, string[]>) {
    const errorCount = Object.keys(errors).length;
    
    if (errorCount === 1) {
      const fieldName = Object.keys(errors)[0];
      const messages = errors[fieldName];
      this.notificationHandler?.error(`${fieldName}: ${messages.join(', ')}`);
    } else {
      this.notificationHandler?.error(`Please fix ${errorCount} validation errors`);
    }
  }
}

// Export singleton instance
export const notificationService = NotificationService.getInstance();

/**
 * Utility functions for common notification patterns
 */
/** API response structure for notification handling */
interface ApiResponseForNotification {
  success: boolean;
  errorCode?: string;
  [key: string]: unknown;
}

export const NotificationUtils = {
  /**
   * Handle API response with automatic error/success notifications
   */
  handleApiResponse: (response: ApiResponseForNotification, successMessage?: string) => {
    if (response.success) {
      // Note: GENERIC_SUCCESS is not in SUCCESS_MESSAGE_MAPPING, would need to add it
      notificationService.showSuccessByCode('CONTACT_CREATED');
    } else {
      notificationService.showErrorByCode(response.errorCode || 'GENERIC_UNKNOWN_ERROR');
    }
  },

  /**
   * Wrap async operations with loading notifications
   */
  withLoading: async <T>(
    operation: () => Promise<T>,
    loadingMessage: string,
    successMessage?: string
  ): Promise<T> => {
    const loadingId = notificationService.showLoading(loadingMessage);
    
    try {
      const result = await operation();
      notificationService.updateNotification(loadingId, successMessage || 'Operation completed', 'success');
      return result;
    } catch (error) {
      notificationService.updateNotification(loadingId, 'Operation failed', 'error');
      throw error;
    }
  },

  /**
   * Confirm action with notification
   */
  confirmAction: (message: string, onConfirm: () => void) => {
    // This would integrate with a confirmation dialog
    // For now, simple implementation
    if (confirm(message)) {
      onConfirm();
    }
  }
};