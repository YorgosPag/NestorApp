import { useTranslation } from 'react-i18next';
import { useCallback } from 'react';
import toast from 'react-hot-toast';
import { z } from 'zod';
import { FieldErrors, FieldValues } from 'react-hook-form';

// Form error severity levels
export type ErrorSeverity = 'error' | 'warning' | 'info';

// Form error display options
export interface ErrorDisplayOptions {
  showToast?: boolean;
  toastDuration?: number;
  severity?: ErrorSeverity;
  title?: string;
  groupErrors?: boolean;
}

// Form error context
export interface FormErrorContext {
  formName?: string;
  fieldLabel?: string;
  fieldValue?: any;
  timestamp?: Date;
}

// Enhanced error handler hook
export function useFormErrorHandler() {
  const { t } = useTranslation('forms');

  // Handle single field error
  const handleFieldError = useCallback((
    field: string,
    error: string,
    context?: FormErrorContext,
    options?: ErrorDisplayOptions
  ) => {
    const {
      showToast = false,
      toastDuration = 4000,
      severity = 'error',
      title,
      groupErrors = false
    } = options || {};

    const errorMessage = error.startsWith('forms.validation.') 
      ? t(error.replace('forms.validation.', 'validation.'))
      : error;

    if (showToast) {
      const displayMessage = title ? `${title}: ${errorMessage}` : errorMessage;
      
      switch (severity) {
        case 'error':
          toast.error(displayMessage, { duration: toastDuration });
          break;
        case 'warning':
          toast(displayMessage, { 
            icon: '⚠️',
            duration: toastDuration,
            style: { background: '#FEF3C7', color: '#92400E' }
          });
          break;
        case 'info':
          toast(displayMessage, { 
            icon: 'ℹ️',
            duration: toastDuration,
            style: { background: '#DBEAFE', color: '#1E40AF' }
          });
          break;
      }
    }

    // Log error for debugging
    if (process.env.NODE_ENV === 'development') {
      console.warn(`Form validation error in field "${field}":`, {
        error: errorMessage,
        context,
        options
      });
    }

    return errorMessage;
  }, [t]);

  // Handle multiple field errors
  const handleFormErrors = useCallback((
    errors: FieldErrors<FieldValues> | Record<string, string>,
    context?: FormErrorContext,
    options?: ErrorDisplayOptions
  ) => {
    const {
      showToast = true,
      toastDuration = 5000,
      severity = 'error',
      groupErrors = true
    } = options || {};

    const errorEntries = Object.entries(errors);
    
    if (errorEntries.length === 0) return {};

    const processedErrors: Record<string, string> = {};

    // Process each error
    errorEntries.forEach(([field, error]) => {
      const errorMessage = typeof error === 'string' ? error : error?.message || 'Unknown error';
      processedErrors[field] = handleFieldError(field, errorMessage, context, { 
        ...options, 
        showToast: false // Don't show individual toasts when grouping
      });
    });

    // Show grouped toast if enabled
    if (showToast && groupErrors) {
      const errorCount = errorEntries.length;
      const firstError = Object.values(processedErrors)[0];
      
      let toastMessage: string;
      
      if (errorCount === 1) {
        toastMessage = firstError;
      } else {
        toastMessage = t('validation.fillAllRequired', { count: errorCount });
      }

      switch (severity) {
        case 'error':
          toast.error(toastMessage, { duration: toastDuration });
          break;
        case 'warning':
          toast(toastMessage, { 
            icon: '⚠️',
            duration: toastDuration,
            style: { background: '#FEF3C7', color: '#92400E' }
          });
          break;
        case 'info':
          toast(toastMessage, { 
            icon: 'ℹ️',
            duration: toastDuration,
            style: { background: '#DBEAFE', color: '#1E40AF' }
          });
          break;
      }
    } else if (showToast && !groupErrors) {
      // Show individual toasts for each error
      errorEntries.forEach(([field, error], index) => {
        setTimeout(() => {
          const errorMessage = typeof error === 'string' ? error : error?.message || 'Unknown error';
          handleFieldError(field, errorMessage, context, { 
            ...options, 
            showToast: true 
          });
        }, index * 100); // Stagger the toasts
      });
    }

    return processedErrors;
  }, [t, handleFieldError]);

  // Handle Zod validation errors
  const handleZodError = useCallback((
    error: z.ZodError,
    context?: FormErrorContext,
    options?: ErrorDisplayOptions
  ) => {
    const formattedErrors: Record<string, string> = {};
    
    error.errors.forEach((err) => {
      const path = err.path.join('.');
      formattedErrors[path] = err.message;
    });

    return handleFormErrors(formattedErrors, context, options);
  }, [handleFormErrors]);

  // Handle server/API errors
  const handleServerError = useCallback((
    error: any,
    fallbackMessage?: string,
    context?: FormErrorContext,
    options?: ErrorDisplayOptions
  ) => {
    const {
      showToast = true,
      toastDuration = 5000,
      severity = 'error'
    } = options || {};

    let errorMessage = fallbackMessage || t('validation.fieldError');

    // Extract error message from different error formats
    if (typeof error === 'string') {
      errorMessage = error;
    } else if (error?.message) {
      errorMessage = error.message;
    } else if (error?.response?.data?.message) {
      errorMessage = error.response.data.message;
    } else if (error?.response?.data?.error) {
      errorMessage = error.response.data.error;
    }

    if (showToast) {
      switch (severity) {
        case 'error':
          toast.error(errorMessage, { duration: toastDuration });
          break;
        case 'warning':
          toast(errorMessage, { 
            icon: '⚠️',
            duration: toastDuration,
            style: { background: '#FEF3C7', color: '#92400E' }
          });
          break;
        case 'info':
          toast(errorMessage, { 
            icon: 'ℹ️',
            duration: toastDuration,
            style: { background: '#DBEAFE', color: '#1E40AF' }
          });
          break;
      }
    }

    // Log server error for debugging
    if (process.env.NODE_ENV === 'development') {
      console.error('Server error in form:', {
        error,
        context,
        options
      });
    }

    return errorMessage;
  }, [t]);

  // Success message handler
  const handleSuccess = useCallback((
    message: string,
    options?: { duration?: number; title?: string }
  ) => {
    const { duration = 4000, title } = options || {};
    const displayMessage = title ? `${title}: ${message}` : message;
    
    toast.success(displayMessage, { duration });
  }, []);

  // Clear all toasts
  const clearAllToasts = useCallback(() => {
    toast.dismiss();
  }, []);

  return {
    handleFieldError,
    handleFormErrors,
    handleZodError,
    handleServerError,
    handleSuccess,
    clearAllToasts,
  };
}

// Utility function to create standardized error messages
export const createErrorMessage = (
  key: string,
  params?: Record<string, any>,
  namespace: string = 'forms'
) => {
  return `${namespace}.validation.${key}`;
};

// Common error message generators
export const errorMessages = {
  required: (field?: string) => createErrorMessage('required'),
  invalidEmail: () => createErrorMessage('invalidEmail'),
  invalidPhone: () => createErrorMessage('invalidPhone'),
  minLength: (min: number) => createErrorMessage('minLength', { min }),
  maxLength: (max: number) => createErrorMessage('maxLength', { max }),
  minValue: (min: number) => createErrorMessage('minValue', { min }),
  maxValue: (max: number) => createErrorMessage('maxValue', { max }),
  positiveNumber: () => createErrorMessage('positiveNumber'),
  invalidSelection: () => createErrorMessage('invalidSelection'),
  confirmPassword: () => createErrorMessage('confirmPassword'),
  areaRequired: () => createErrorMessage('areaRequired'),
  priceRequired: () => createErrorMessage('priceRequired'),
};

// Form validation result type
export interface ValidationResult<T = any> {
  isValid: boolean;
  data?: T;
  errors?: Record<string, string>;
  warnings?: Record<string, string>;
}

// Enhanced validation result handler
export const createValidationResult = <T>(
  success: boolean,
  data?: T,
  errors?: Record<string, string>,
  warnings?: Record<string, string>
): ValidationResult<T> => {
  return {
    isValid: success,
    data,
    errors: errors || {},
    warnings: warnings || {},
  };
};