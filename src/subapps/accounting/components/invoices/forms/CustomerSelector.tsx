'use client';

/**
 * @fileoverview Invoice Customer Selector with Contact Autocomplete
 * @description Πελάτης τιμολογίου: autocomplete από επαφές → auto-fill ΑΦΜ, ΔΟΥ, διεύθυνση, email
 * @updated 2026-02-10
 * @version 1.1.0 — Added contact autocomplete for auto-fill
 * @compliance CLAUDE.md Enterprise Standards — zero `any`, no inline styles, semantic HTML
 */

import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DoyPicker } from '@/components/ui/doy-picker';
import { ContactSearchManager } from '@/components/contacts/relationships/ContactSearchManager';
import type { Contact } from '@/types/contacts';
import { extractContactParty } from '@/subapps/accounting/utils/contact-party';
import { useContactAutoFill } from '@/subapps/accounting/hooks/useContactAutoFill';
import { useVatUniqueness } from '@/hooks/useVatUniqueness';
import type { InvoiceCustomer } from '@/subapps/accounting/types';

import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';

import { cn } from '@/lib/utils';

// ============================================================================
// TYPES
// ============================================================================

interface CustomerSelectorProps {
  customer: InvoiceCustomer;
  onCustomerChange: (customer: InvoiceCustomer) => void;
}

// ============================================================================
// HELPERS
// ============================================================================

/** Επαφή → πελάτης τιμολογίου. Η εξαγωγή είναι SSoT (`extractContactParty`)· εδώ μόνο τα πεδία. */
function mapContactToCustomer(contact: Contact): InvoiceCustomer {
  const party = extractContactParty(contact);
  return {
    contactId: contact.id ?? null,
    name: party.name,
    vatNumber: party.vatNumber,
    taxOffice: party.taxOffice,
    address: party.street || null,
    city: party.city,
    postalCode: party.postalCode,
    country: party.country ?? 'GR',
    email: party.email,
  };
}

// ============================================================================
// COMPONENT
// ============================================================================

export function CustomerSelector({ customer, onCustomerChange }: CustomerSelectorProps) {
  const { t } = useTranslation(['accounting', 'accounting-setup', 'accounting-tax-offices']);
  const colors = useSemanticColors();
  const applyContact = useCallback(
    (contact: Contact) => onCustomerChange(mapContactToCustomer(contact)),
    [onCustomerChange],
  );
  const { selectedContactId, autoFillMessage, handleContactAutoFill } =
    useContactAutoFill(applyContact, customer.contactId ?? '');
  const { result: vatResult } = useVatUniqueness(customer.vatNumber ?? undefined);

  const updateField = (field: keyof InvoiceCustomer, value: string | null) => {
    onCustomerChange({ ...customer, [field]: value || null });
  };


  return (
    <div className="space-y-4">
      {/* Row 1: Πελάτης (autocomplete) + ΑΦΜ */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <fieldset className="space-y-2">
          <Label>{t('invoices.customer')} *</Label>
          <ContactSearchManager
            selectedContactId={selectedContactId}
            onContactSelect={handleContactAutoFill}
            allowedContactTypes={['individual', 'company', 'service']}
            label=""
            placeholder={t('setup.searchContact')}
            searchConfig={{ autoLoadContacts: true, maxResults: 20 }}
          />
          {autoFillMessage && (
            <p className={cn("text-sm", colors.text.muted)}>{autoFillMessage}</p>
          )}
          <Input
            id="customerName"
            value={customer.name}
            onChange={(e) => onCustomerChange({ ...customer, name: e.target.value })}
            placeholder={t('invoices.customer')}
            required
          />
        </fieldset>

        <fieldset>
          <Label htmlFor="customerVat">{t('invoices.customerForm.vatNumber')}</Label>
          <Input
            id="customerVat"
            value={customer.vatNumber ?? ''}
            onChange={(e) => updateField('vatNumber', e.target.value)}
            maxLength={9}
          />
          {vatResult && !vatResult.isUnique && vatResult.existingContact && (
            <p className="mt-1 text-xs text-destructive font-medium" role="alert">
              {t('setup.vatDuplicateWarning', { contactName: vatResult.existingContact.name })
                .replace('{{contactName}}', vatResult.existingContact.name)}
            </p>
          )}
        </fieldset>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <fieldset>
          <Label htmlFor="customerTaxOffice">{t('invoices.customerForm.taxOffice')}</Label>
          <DoyPicker
            id="customerTaxOffice"
            value={customer.taxOffice ?? ''}
            onValueChange={(val) => updateField('taxOffice', val)}
            showAddNew={false}
          />
        </fieldset>

        <fieldset>
          <Label htmlFor="customerAddress">{t('invoices.customerForm.address')}</Label>
          <Input
            id="customerAddress"
            value={customer.address ?? ''}
            onChange={(e) => updateField('address', e.target.value)}
          />
        </fieldset>

        <fieldset>
          <Label htmlFor="customerCity">{t('invoices.customerForm.city')}</Label>
          <Input
            id="customerCity"
            value={customer.city ?? ''}
            onChange={(e) => updateField('city', e.target.value)}
          />
        </fieldset>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <fieldset>
          <Label htmlFor="customerPostalCode">{t('invoices.customerForm.postalCode')}</Label>
          <Input
            id="customerPostalCode"
            value={customer.postalCode ?? ''}
            onChange={(e) => updateField('postalCode', e.target.value)}
          />
        </fieldset>

        <fieldset>
          <Label htmlFor="customerEmail">Email</Label>
          <Input
            id="customerEmail"
            type="email"
            value={customer.email ?? ''}
            onChange={(e) => updateField('email', e.target.value)}
          />
        </fieldset>
      </div>
    </div>
  );
}
