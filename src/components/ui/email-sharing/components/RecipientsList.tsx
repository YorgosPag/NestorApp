// ============================================================================
// 👥 RECIPIENTS LIST COMPONENT - ΚΕΝΤΡΙΚΟΠΟΙΗΜΕΝΟ
// ============================================================================
//
// 🎯 PURPOSE: Reusable email recipients management με enterprise features
// 🔗 USED BY: EmailShareForm, BulkEmailSender, ContactEmailer
// 🏢 STANDARDS: Enterprise form patterns, accessibility, validation
//
// ============================================================================

'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { designSystem } from '@/lib/design-system';
import { INTERACTIVE_PATTERNS } from '@/components/ui/effects';
import { Users, Plus, Trash2, AlertCircle, CheckCircle } from 'lucide-react';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
// 🏢 ENTERPRISE: i18n - Full internationalization support
import { useTranslation } from '@/i18n/hooks/useTranslation';

// Types
import type { RecipientsListProps } from '../types';
import { isValidEmail, VALIDATION_MESSAGES } from '../types';

// ============================================================================
// RECIPIENTS LIST COMPONENT
// ============================================================================

/**
 * 👥 RecipientsList Component
 *
 * Enterprise recipients management για email forms
 *
 * Features:
 * - Dynamic add/remove recipients
 * - Real-time email validation
 * - Visual validation feedback
 * - Accessibility support
 * - Custom validation functions
 * - Responsive design
 */
export const RecipientsList: React.FC<RecipientsListProps> = ({
  recipients,
  onRecipientsChange,
  maxRecipients = 5,
  disabled = false,
  validateEmails,
  showValidation = true
}) => {
  // 🏢 ENTERPRISE: i18n hook for translations
  const { t } = useTranslation('common');
  const iconSizes = useIconSizes();
  const { getStatusBorder } = useBorderTokens();
  const colors = useSemanticColors();

  // ============================================================================
  // COMPUTED VALUES
  // ============================================================================

  const validEmails = recipients.filter(email => email.trim() && isValidEmail(email));
  const hasEmptySlots = recipients.length < maxRecipients;
  const customValidationError = validateEmails ? validateEmails(validEmails) : null;

  // ============================================================================
  // EVENT HANDLERS
  // ============================================================================

  /**
   * ➕ Add new email recipient
   */
  const handleAddRecipient = () => {
    if (hasEmptySlots && !disabled) {
      onRecipientsChange([...recipients, '']);
    }
  };

  /**
   * ❌ Remove email recipient
   */
  const handleRemoveRecipient = (index: number) => {
    if (recipients.length > 1 && !disabled) {
      onRecipientsChange(recipients.filter((_, i) => i !== index));
    }
  };

  /**
   * ✏️ Update email recipient
   */
  const handleUpdateRecipient = (index: number, value: string) => {
    if (!disabled) {
      const newRecipients = [...recipients];
      newRecipients[index] = value;
      onRecipientsChange(newRecipients);
    }
  };

  /**
   * ⌨️ Handle keyboard events
   */
  const handleKeyDown = (
    event: React.KeyboardEvent<HTMLInputElement>,
    index: number
  ) => {
    if (event.key === 'Enter' && hasEmptySlots) {
      event.preventDefault();
      handleAddRecipient();
    } else if (event.key === 'Backspace' && recipients[index] === '' && recipients.length > 1) {
      event.preventDefault();
      handleRemoveRecipient(index);
    }
  };

  // ============================================================================
  // VALIDATION HELPERS
  // ============================================================================

  /**
   * 🔍 Get email validation state
   */
  const getEmailValidationState = (email: string, index: number) => {
    if (!email.trim()) {
      return { isValid: true, showError: false, message: '' };
    }

    const isValid = isValidEmail(email);
    return {
      isValid,
      showError: !isValid && showValidation,
      message: !isValid ? VALIDATION_MESSAGES.INVALID_EMAIL : ''
    };
  };

  /**
   * 🎨 Get input styling based on validation
   */
  const getInputStyling = (email: string) => {
    const validation = getEmailValidationState(email, 0);

    if (!showValidation || !email.trim()) {
      return '';
    }

    return validation.isValid
      ? `${getStatusBorder('success')} focus:ring-green-500`
      : `${getStatusBorder('error')} focus:ring-red-500`;
  };

  // ============================================================================
  // RENDER HELPERS
  // ============================================================================

  /**
   * 📧 Render individual email input
   */
  const renderEmailInput = (email: string, index: number) => {
    const validation = getEmailValidationState(email, index);
    const canRemove = recipients.length > 1;

    return (
      <article key={index} className="flex gap-2 items-start" role="group" aria-label={t('recipients.recipientLabel', { number: index + 1 })}>
        <section className="flex-1">
          <div className="relative">
            <Input
              type="email"
              placeholder={`Email ${index + 1}`}
              value={email}
              onChange={(e) => handleUpdateRecipient(index, e.target.value)}
              onKeyDown={(e) => handleKeyDown(e, index)}
              disabled={disabled}
              className={designSystem.cn(
                'pr-8',
                getInputStyling(email)
              )}
              aria-label={`Email recipient ${index + 1}`}
              aria-invalid={validation.showError}
              aria-describedby={validation.showError ? `email-error-${index}` : undefined}
            />

            {/* Validation Icon */}
            {showValidation && email.trim() && (
              <aside className="absolute right-2 top-1/2 transform -translate-y-1/2" role="status" aria-label={t('recipients.validationStatus')}>
                {validation.isValid ? (
                  <CheckCircle className={`${iconSizes.sm} text-green-500`} />
                ) : (
                  <AlertCircle className={`${iconSizes.sm} text-red-500`} />
                )}
              </aside>
            )}
          </div>

          {/* Validation Message */}
          {validation.showError && (
            <p
              id={`email-error-${index}`}
              className={designSystem.cn(
                designSystem.getTypographyClass('xs'),
                'text-red-600 dark:text-red-400 mt-1'
              )}
              role="alert"
            >
              {validation.message}
            </p>
          )}
        </section>

        {/* Remove Button */}
        {canRemove && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => handleRemoveRecipient(index)}
            disabled={disabled}
            className={designSystem.cn(
              'text-red-500',
              INTERACTIVE_PATTERNS.BUTTON_DESTRUCTIVE_GHOST,
              'mt-0.5' // Align with input
            )}
            aria-label={`Remove email ${index + 1}`}
          >
            <Trash2 className={iconSizes.sm} />
          </Button>
        )}
      </article>
    );
  };

  /**
   * 📊 Render recipients summary
   */
  const renderSummary = () => {
    const totalRecipients = recipients.length;
    const validCount = validEmails.length;
    const invalidCount = recipients.filter(email =>
      email.trim() && !isValidEmail(email)
    ).length;

    return (
      <footer className="flex items-center justify-between text-sm" role="status">
        <span className={designSystem.cn(
          designSystem.getTypographyClass('xs'),
          'text-muted-foreground'
        )}>
          {t('recipients.validFromTotal', { valid: validCount, total: totalRecipients })}
          {invalidCount > 0 && (
            <span className="text-red-500 ml-2">
              {t('recipients.invalidCount', { count: invalidCount })}
            </span>
          )}
        </span>

        <span className={designSystem.cn(
          designSystem.getTypographyClass('xs'),
          'text-muted-foreground'
        )}>
          {t('recipients.available', { count: maxRecipients - totalRecipients })}
        </span>
      </footer>
    );
  };

  // ============================================================================
  // MAIN RENDER
  // ============================================================================

  return (
    <section className="space-y-3" role="region" aria-label={t('recipients.managementLabel')}>
      {/* Header */}
      <header className="flex items-center justify-between" role="banner">
        <Label className={designSystem.cn(
          "flex items-center gap-2",
          designSystem.getTypographyClass('sm', 'medium'),
          disabled && 'text-gray-400 dark:text-gray-500'
        )}>
          <Users className={designSystem.cn(
            iconSizes.sm,
            disabled ? 'text-gray-400' : 'text-blue-600'
          )} />
          {t('recipients.emailRecipients')}
        </Label>

        {/* Add Button */}
        {hasEmptySlots && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleAddRecipient}
            disabled={disabled}
            className={designSystem.cn(
              'text-blue-600',
              INTERACTIVE_PATTERNS.BUTTON_PRIMARY_GHOST,
              disabled && 'opacity-50 cursor-not-allowed'
            )}
          >
            <Plus className={`${iconSizes.sm} mr-1`} />
            {t('recipients.add')}
          </Button>
        )}
      </header>

      {/* Recipients Inputs */}
      <main className="space-y-3" role="main">
        {recipients.map(renderEmailInput)}
      </main>

      {/* Summary */}
      {renderSummary()}

      {/* Custom Validation Error */}
      {customValidationError && showValidation && (
        <aside className={`p-3 ${colors.bg.error} rounded-lg ${getStatusBorder('error')}`} role="alert">
          <p className={designSystem.cn(
            designSystem.getTypographyClass('sm', 'medium'),
            'text-red-800 dark:text-red-300 flex items-center gap-2'
          )}>
            <AlertCircle className={iconSizes.sm} />
            {customValidationError}
          </p>
        </aside>
      )}

      {/* Helper Text */}
      <aside className={designSystem.cn(
        designSystem.getTypographyClass('xs'),
        'text-muted-foreground',
        disabled && 'text-gray-400'
      )} role="note">
        {t('recipients.helperText')}
      </aside>
    </section>
  );
};

// ============================================================================
// COMPACT VARIANT
// ============================================================================

/**
 * 👥 Compact Recipients List για περιορισμένο χώρο
 */
export const CompactRecipientsList: React.FC<RecipientsListProps & {
  showSummary?: boolean;
}> = ({
  recipients,
  onRecipientsChange,
  maxRecipients = 3,
  disabled = false,
  validateEmails,
  showValidation = true,
  showSummary = true
}) => {
  // 🏢 ENTERPRISE: i18n hook for translations
  const { t } = useTranslation('common');
  const iconSizes = useIconSizes();
  const validCount = recipients.filter(email => email.trim() && isValidEmail(email)).length;

  return (
    <section className="space-y-2" role="region" aria-label={t('recipients.compactLabel')}>
      <Label className={designSystem.cn(
        "flex items-center gap-1.5",
        designSystem.getTypographyClass('xs', 'medium')
      )}>
        <Users className={iconSizes.xs} />
        {t('recipients.recipientsCount', { count: validCount })}
      </Label>

      <nav className="space-y-1.5" role="group" aria-label={t('recipients.compactInputsLabel')}>
        {recipients.map((email, index) => (
          <article key={index} className="flex gap-1.5" role="group" aria-label={t('recipients.compactEmailLabel', { number: index + 1 })}>
            <Input
              type="email"
              placeholder={`Email ${index + 1}`}
              value={email}
              onChange={(e) => {
                const newRecipients = [...recipients];
                newRecipients[index] = e.target.value;
                onRecipientsChange(newRecipients);
              }}
              disabled={disabled}
              className="text-xs h-8"
            />
            {recipients.length > 1 && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onRecipientsChange(recipients.filter((_, i) => i !== index))}
                disabled={disabled}
                className={designSystem.cn(
                  `${iconSizes.xl} p-0 text-red-500`,
                  INTERACTIVE_PATTERNS.BUTTON_DESTRUCTIVE_GHOST
                )}
              >
                <Trash2 className={iconSizes.xs} />
              </Button>
            )}
          </article>
        ))}

        {recipients.length < maxRecipients && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onRecipientsChange([...recipients, ''])}
            disabled={disabled}
            className={designSystem.cn(
              "h-8 w-full text-xs text-blue-600",
              INTERACTIVE_PATTERNS.BUTTON_PRIMARY_GHOST
            )}
          >
            <Plus className={`${iconSizes.xs} mr-1`} />
            {t('recipients.addEmail')}
          </Button>
        )}
      </nav>

      {showSummary && (
        <aside className={designSystem.cn(
          designSystem.getTypographyClass('xs'),
          'text-muted-foreground'
        )} role="status">
          {validCount} {t('recipients.valid')}
        </aside>
      )}
    </section>
  );
};

// ============================================================================
// EXPORTS
// ============================================================================

export default RecipientsList;