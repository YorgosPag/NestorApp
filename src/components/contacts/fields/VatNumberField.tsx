'use client';

import '@/lib/design-system';

/**
 * @module VatNumberField
 * @description Reusable VAT (ΑΦΜ) input field with real-time uniqueness checking.
 *
 * Below the input: who already holds the VAT number and what the save will do —
 * `block` (two individuals) or `confirm` (any other pair). ADR-944 §9.
 *
 * Used as a customRenderer in IndividualFormRenderer / CompanyFormRenderer
 * via the UnifiedContactTabbedSection customRenderers mechanism.
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import { UniversalClickableField } from '@/components/ui/form/UniversalClickableField';
import { useVatDuplicateDecision } from '@/hooks/useVatUniqueness';
import type { IndividualFieldConfig } from '@/config/individual-config';
import type { ContactType } from '@/types/contacts';
import { VatDuplicateNotice } from './VatDuplicateNotice';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { cn } from '@/lib/utils';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

interface VatNumberFieldProps {
  field: IndividualFieldConfig;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  disabled: boolean;
  excludeContactId?: string;
  /** Ο τύπος της επαφής που γράφεται — από αυτόν εξαρτάται αν το διπλό ΑΦΜ απαγορεύεται ή θέλει επιβεβαίωση. */
  contactType: ContactType;
  /** Το ΑΦΜ που έχει **ήδη** η επαφή — ίδιο ⇒ καμία υπόσχεση φραγμού/επιβεβαίωσης (ADR-944 §9.8). Χωρίς επαφή: `undefined`. */
  storedVatNumber?: string;
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
  contactType,
  storedVatNumber,
}: VatNumberFieldProps) {
  const { t } = useTranslation('contacts');
  const colors = useSemanticColors();
  const { isChecking, decision, holders } = useVatDuplicateDecision(value, contactType, excludeContactId, storedVatNumber);

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
        <p className={cn("mt-1 text-xs", colors.text.muted)}>
          {t('validation.vatChecking')}
        </p>
      )}

      {/* Διπλό ΑΦΜ — η ίδια απόφαση που θα πάρει ο φρουρός στην αποθήκευση (ADR-944 §9) */}
      <VatDuplicateNotice vatNumber={value} decision={decision} holders={holders} />
    </div>
  );
}
