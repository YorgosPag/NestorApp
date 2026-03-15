'use client';

/**
 * @module VatNumberField
 * @description Reusable VAT (ΑΦΜ) input field with real-time uniqueness checking.
 *
 * Shows a warning message below the input when the VAT number is already
 * used by another contact (cross-type: individual, company, service).
 *
 * Used as a customRenderer in IndividualFormRenderer / CompanyFormRenderer
 * via the UnifiedContactTabbedSection customRenderers mechanism.
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import { UniversalClickableField } from '@/components/ui/form/UniversalClickableField';
import { useVatUniqueness } from '@/hooks/useVatUniqueness';
import type { IndividualFieldConfig } from '@/config/individual-config';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

interface VatNumberFieldProps {
  field: IndividualFieldConfig;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  disabled: boolean;
  excludeContactId?: string;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function VatNumberField({
  field,
  value,
  onChange,
  disabled,
  excludeContactId,
}: VatNumberFieldProps) {
  const { t } = useTranslation('contacts');
  const { isChecking, result } = useVatUniqueness(value, excludeContactId);

  const showWarning = result && !result.isUnique && result.existingContact;

  return (
    <div className="w-full">
      <UniversalClickableField
        id={field.id}
        name={field.id}
        type={field.type}
        value={value}
        onChange={onChange}
        disabled={disabled}
        required={field.required}
        placeholder={field.placeholder}
        maxLength={field.maxLength}
        className={field.className}
      />

      {/* Loading indicator */}
      {isChecking && (
        <p className="mt-1 text-xs text-muted-foreground">
          {t('validation.vatChecking')}
        </p>
      )}

      {/* Duplicate warning */}
      {showWarning && result.existingContact && (
        <p className="mt-1 text-xs text-destructive font-medium" role="alert">
          {t('validation.vatDuplicate', {
            vatNumber: value,
            contactName: result.existingContact.name,
          })}
        </p>
      )}
    </div>
  );
}
