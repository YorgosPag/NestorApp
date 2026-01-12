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
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';

// Types
import type { ValidationErrorsProps } from '../types';
// 🏢 ENTERPRISE: i18n - Full internationalization support
import { useTranslation } from '@/i18n/hooks/useTranslation';

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
  // 🏢 ENTERPRISE: i18n hook for translations
  const { t } = useTranslation('common');
  const iconSizes = useIconSizes();
  const { quick, getStatusBorder } = useBorderTokens();
  const colors = useSemanticColors();

  // Early return if hidden or no errors
  if (!show || (!error && !backendError)) return null;

  return (
    <section className="space-y-3" role="alert" aria-live="polite" aria-label={t('validation.errorsLabel')}>
      {/* Validation Error */}
      {error && (
        <article className={`p-3 ${colors.bg.warningSubtle} ${quick.card} ${quick.input} ${getStatusBorder('warning')}`} role="alert" aria-label={t('validation.validationError')}>
          <header className={designSystem.cn(
            'flex items-start gap-3',
            designSystem.getTypographyClass('sm', 'medium'),
            `${colors.text.warning}`
          )} role="banner">
            <AlertTriangle className={`${iconSizes.md} mt-0.5 flex-shrink-0`} />
            <main>
              <h4 className="font-medium mb-1">{t('validation.validationError')}</h4>
              <p className={designSystem.cn(
                designSystem.getTypographyClass('sm'),
                `${colors.text.warning}`
              )}>
                {error}
              </p>
            </main>
          </header>
        </article>
      )}

      {/* Backend Error */}
      {backendError && (
        <article className={`p-3 ${colors.bg.errorSubtle} ${quick.card} ${quick.input} ${getStatusBorder('error')}`} role="alert" aria-label={t('validation.systemError')}>
          <header className={designSystem.cn(
            'flex items-start gap-3',
            designSystem.getTypographyClass('sm', 'medium'),
            `${colors.text.danger}`
          )} role="banner">
            <XCircle className={`${iconSizes.md} mt-0.5 flex-shrink-0`} />
            <main>
              <h4 className="font-medium mb-1">{t('validation.systemError')}</h4>
              <p className={designSystem.cn(
                designSystem.getTypographyClass('sm'),
                `${colors.text.danger}`
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
  // 🏢 ENTERPRISE: i18n hook for translations
  const { t } = useTranslation('common');
  const iconSizes = useIconSizes();
  const { quick, getStatusBorder } = useBorderTokens();
  const colors = useSemanticColors();

  if (!show || (!error && !backendError)) return null;

  const errorToShow = backendError || error;

  if (variant === 'inline') {
    return (
      <aside className={`flex items-center gap-2 ${colors.text.danger} text-xs`} role="alert" aria-live="polite" aria-label={t('validation.incompleteValidation')}>
        <AlertCircle className={`${iconSizes.xs} flex-shrink-0`} />
        <span>{errorToShow}</span>
      </aside>
    );
  }

  return (
    <aside className={`p-2 ${colors.bg.errorSubtle} ${quick.card} ${quick.input} ${getStatusBorder('error')}`} role="alert" aria-label={t('validation.compactValidation')}>
      <p className={`flex items-center gap-2 ${colors.text.danger} text-xs`}>
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
  // 🏢 ENTERPRISE: i18n hook for translations
  const { t } = useTranslation('common');
  const iconSizes = useIconSizes();
  const colors = useSemanticColors();

  if (!show || !error) return null;

  return (
    <aside
      id={fieldId ? `${fieldId}-error` : undefined}
      className={designSystem.cn(
        'flex items-center gap-1.5 mt-1',
        designSystem.getTypographyClass('xs'),
        `${colors.text.danger}`
      )}
      role="alert"
      aria-label={t('validation.fieldError')}
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
  // 🏢 ENTERPRISE: i18n hook for translations
  const { t } = useTranslation('common');
  const { quick, getStatusBorder } = useBorderTokens();
  const iconSizes = useIconSizes();
  const colors = useSemanticColors();
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
    <aside className={`p-3 ${colors.bg.successSubtle} ${quick.card} ${quick.input} ${getStatusBorder('success')}`} role="status" aria-live="polite" aria-label={t('validation.successMessage')}>
      <p className={designSystem.cn(
        'flex items-center gap-2',
        designSystem.getTypographyClass('sm', 'medium'),
        `${colors.text.success}`
      )}>
        <figure className={`${iconSizes.md} rounded-full ${colors.bg.success} flex items-center justify-center flex-shrink-0`} role="img" aria-label={t('validation.successIcon')}>
          <div className={`${iconSizes.xs} ${designSystem.getBackgroundColor('primary')} rounded-full`} />
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