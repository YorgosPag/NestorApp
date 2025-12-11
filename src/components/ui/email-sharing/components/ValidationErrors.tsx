// ============================================================================
// ❌ VALIDATION ERRORS COMPONENT - ΚΕΝΤΡΙΚΟΠΟΙΗΜΕΝΟ
// ============================================================================
//
// 🎯 PURPOSE: Reusable validation errors display με enterprise styling
// 🔗 USED BY: EmailShareForm, ContactForms, ValidationComponents
// 🏢 STANDARDS: Enterprise error handling, accessibility, UX
//
// ============================================================================

'use client';

import React from 'react';
import { designSystem } from '@/lib/design-system';
import { AlertCircle, AlertTriangle, XCircle } from 'lucide-react';

// Types
import type { ValidationErrorsProps } from '../types';

// ============================================================================
// VALIDATION ERRORS COMPONENT
// ============================================================================

/**
 * ❌ ValidationErrors Component
 *
 * Enterprise error display για forms και validation
 *
 * Features:
 * - Multiple error types support
 * - Visual distinction για validation vs backend errors
 * - Accessibility support
 * - Auto-hide functionality
 * - Icon-based error categorization
 */
export const ValidationErrors: React.FC<ValidationErrorsProps> = ({
  error,
  backendError,
  show = true
}) => {
  // Early return if hidden or no errors
  if (!show || (!error && !backendError)) return null;

  return (
    <div className="space-y-3">
      {/* Validation Error */}
      {error && (
        <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
          <div className={designSystem.cn(
            'flex items-start gap-3',
            designSystem.getTypographyClass('sm', 'medium'),
            'text-yellow-800 dark:text-yellow-300'
          )}>
            <AlertTriangle className="w-5 h-5 mt-0.5 flex-shrink-0" />
            <div>
              <div className="font-medium mb-1">Σφάλμα Επικύρωσης</div>
              <div className={designSystem.cn(
                designSystem.getTypographyClass('sm'),
                'text-yellow-700 dark:text-yellow-200'
              )}>
                {error}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Backend Error */}
      {backendError && (
        <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
          <div className={designSystem.cn(
            'flex items-start gap-3',
            designSystem.getTypographyClass('sm', 'medium'),
            'text-red-800 dark:text-red-300'
          )}>
            <XCircle className="w-5 h-5 mt-0.5 flex-shrink-0" />
            <div>
              <div className="font-medium mb-1">Σφάλμα Συστήματος</div>
              <div className={designSystem.cn(
                designSystem.getTypographyClass('sm'),
                'text-red-700 dark:text-red-200'
              )}>
                {backendError}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ============================================================================
// COMPACT VARIANT
// ============================================================================

/**
 * ❌ Compact Validation Errors για περιορισμένο χώρο
 */
export const CompactValidationErrors: React.FC<ValidationErrorsProps & {
  variant?: 'minimal' | 'inline';
}> = ({
  error,
  backendError,
  show = true,
  variant = 'minimal'
}) => {
  if (!show || (!error && !backendError)) return null;

  const errorToShow = backendError || error;

  if (variant === 'inline') {
    return (
      <div className="flex items-center gap-2 text-red-600 dark:text-red-400 text-xs">
        <AlertCircle className="w-3 h-3 flex-shrink-0" />
        <span>{errorToShow}</span>
      </div>
    );
  }

  return (
    <div className="p-2 bg-red-50 dark:bg-red-900/20 rounded border border-red-200 dark:border-red-800">
      <div className="flex items-center gap-2 text-red-700 dark:text-red-300 text-xs">
        <AlertCircle className="w-3 h-3 flex-shrink-0" />
        <span>{errorToShow}</span>
      </div>
    </div>
  );
};

// ============================================================================
// SPECIALIZED VARIANTS
// ============================================================================

/**
 * ⚠️ Field-specific validation error
 */
export const FieldValidationError: React.FC<{
  error?: string;
  show?: boolean;
  fieldId?: string;
}> = ({
  error,
  show = true,
  fieldId
}) => {
  if (!show || !error) return null;

  return (
    <div
      id={fieldId ? `${fieldId}-error` : undefined}
      className={designSystem.cn(
        'flex items-center gap-1.5 mt-1',
        designSystem.getTypographyClass('xs'),
        'text-red-600 dark:text-red-400'
      )}
      role="alert"
    >
      <AlertCircle className="w-3 h-3 flex-shrink-0" />
      <span>{error}</span>
    </div>
  );
};

/**
 * ✅ Success message component
 */
export const SuccessMessage: React.FC<{
  message?: string;
  show?: boolean;
  autoHide?: boolean;
}> = ({
  message,
  show = true,
  autoHide = false
}) => {
  const [isVisible, setIsVisible] = React.useState(show);

  React.useEffect(() => {
    if (autoHide && show && message) {
      const timer = setTimeout(() => setIsVisible(false), 3000);
      return () => clearTimeout(timer);
    }
    setIsVisible(show);
  }, [show, message, autoHide]);

  if (!isVisible || !message) return null;

  return (
    <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
      <div className={designSystem.cn(
        'flex items-center gap-2',
        designSystem.getTypographyClass('sm', 'medium'),
        'text-green-800 dark:text-green-300'
      )}>
        <div className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center flex-shrink-0">
          <div className="w-2 h-2 bg-white rounded-full" />
        </div>
        {message}
      </div>
    </div>
  );
};

// ============================================================================
// EXPORTS
// ============================================================================

export default ValidationErrors;