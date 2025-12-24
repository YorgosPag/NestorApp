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
import { useIconSizes } from '@/hooks/useIconSizes';
import { useBorderTokens } from '@/hooks/useBorderTokens';

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
  const iconSizes = useIconSizes();
  const { quick } = useBorderTokens();

  // Early return if hidden or no errors
  if (!show || (!error && !backendError)) return null;

  return (
    <section className="space-y-3" role="alert" aria-live="polite" aria-label="Σφάλματα Επικύρωσης">
      {/* Validation Error */}
      {error && (
        <article className={`p-3 bg-yellow-50 dark:bg-yellow-900/20 ${quick.card} ${quick.input} border-yellow-200 dark:border-yellow-800`} role="alert" aria-label="Σφάλμα Επικύρωσης">
          <header className={designSystem.cn(
            'flex items-start gap-3',
            designSystem.getTypographyClass('sm', 'medium'),
            'text-yellow-800 dark:text-yellow-300'
          )} role="banner">
            <AlertTriangle className={`${iconSizes.md} mt-0.5 flex-shrink-0`} />
            <main>
              <h4 className="font-medium mb-1">Σφάλμα Επικύρωσης</h4>
              <p className={designSystem.cn(
                designSystem.getTypographyClass('sm'),
                'text-yellow-700 dark:text-yellow-200'
              )}>
                {error}
              </p>
            </main>
          </header>
        </article>
      )}

      {/* Backend Error */}
      {backendError && (
        <article className={`p-3 bg-red-50 dark:bg-red-900/20 ${quick.card} ${quick.input} border-red-200 dark:border-red-800`} role="alert" aria-label="Σφάλμα Συστήματος">
          <header className={designSystem.cn(
            'flex items-start gap-3',
            designSystem.getTypographyClass('sm', 'medium'),
            'text-red-800 dark:text-red-300'
          )} role="banner">
            <XCircle className={`${iconSizes.md} mt-0.5 flex-shrink-0`} />
            <main>
              <h4 className="font-medium mb-1">Σφάλμα Συστήματος</h4>
              <p className={designSystem.cn(
                designSystem.getTypographyClass('sm'),
                'text-red-700 dark:text-red-200'
              )}>
                {backendError}
              </p>
            </main>
          </header>
        </article>
      )}
    </section>
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
  const iconSizes = useIconSizes();
  const { quick } = useBorderTokens();

  if (!show || (!error && !backendError)) return null;

  const errorToShow = backendError || error;

  if (variant === 'inline') {
    return (
      <aside className="flex items-center gap-2 text-red-600 dark:text-red-400 text-xs" role="alert" aria-live="polite" aria-label="Ελλιπής Επικύρωση">
        <AlertCircle className={`${iconSizes.xs} flex-shrink-0`} />
        <span>{errorToShow}</span>
      </aside>
    );
  }

  return (
    <aside className={`p-2 bg-red-50 dark:bg-red-900/20 ${quick.card} ${quick.input} border-red-200 dark:border-red-800`} role="alert" aria-label="Συμπαγής Επικύρωση">
      <p className="flex items-center gap-2 text-red-700 dark:text-red-300 text-xs">
        <AlertCircle className={`${iconSizes.xs} flex-shrink-0`} />
        <span>{errorToShow}</span>
      </p>
    </aside>
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
  const iconSizes = useIconSizes();
  if (!show || !error) return null;

  return (
    <aside
      id={fieldId ? `${fieldId}-error` : undefined}
      className={designSystem.cn(
        'flex items-center gap-1.5 mt-1',
        designSystem.getTypographyClass('xs'),
        'text-red-600 dark:text-red-400'
      )}
      role="alert"
      aria-label="Σφάλμα Πεδίου"
    >
      <AlertCircle className={`${iconSizes.xs} flex-shrink-0`} />
      <span>{error}</span>
    </aside>
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
  const { quick } = useBorderTokens();
  const iconSizes = useIconSizes();
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
    <aside className={`p-3 bg-green-50 dark:bg-green-900/20 ${quick.card} ${quick.input} border-green-200 dark:border-green-800`} role="status" aria-live="polite" aria-label="Μήνυμα Επιτυχίας">
      <p className={designSystem.cn(
        'flex items-center gap-2',
        designSystem.getTypographyClass('sm', 'medium'),
        'text-green-800 dark:text-green-300'
      )}>
        <figure className={`${iconSizes.md} rounded-full bg-green-500 flex items-center justify-center flex-shrink-0`} role="img" aria-label="Εικονίδιο Επιτυχίας">
          <div className={`${iconSizes.xs} bg-white rounded-full`} />
        </figure>
        {message}
      </p>
    </aside>
  );
};

// ============================================================================
// EXPORTS
// ============================================================================

export default ValidationErrors;