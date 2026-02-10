'use client';

/**
 * @fileoverview Invoice Customer Selector with Contact Autocomplete
 * @description Πελάτης τιμολογίου: autocomplete από επαφές → auto-fill ΑΦΜ, ΔΟΥ, διεύθυνση, email
 * @updated 2026-02-10
 * @version 1.1.0 — Added contact autocomplete for auto-fill
 * @compliance CLAUDE.md Enterprise Standards — zero `any`, no inline styles, semantic HTML
 */

import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ContactSearchManager } from '@/components/contacts/relationships/ContactSearchManager';
import type { ContactSummary } from '@/components/ui/enterprise-contact-dropdown';
import { ContactsService } from '@/services/contacts.service';
import {
  isIndividualContact,
  isCompanyContact,
  type Contact,
  type AddressInfo,
  type PhoneInfo,
  type EmailInfo,
} from '@/types/contacts';
import type { InvoiceCustomer } from '@/subapps/accounting/types';

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

function findPrimary<T extends { isPrimary: boolean }>(items: T[] | undefined): T | undefined {
  if (!items || items.length === 0) return undefined;
  return items.find((item) => item.isPrimary) ?? items[0];
}

function extractStreet(addr: AddressInfo | undefined): string {
  if (!addr) return '';
  return addr.number ? `${addr.street} ${addr.number}` : addr.street;
}

/**
 * Map full Contact → InvoiceCustomer fields
 */
function mapContactToCustomer(contact: Contact): InvoiceCustomer {
  const primaryAddress = findPrimary<AddressInfo>(contact.addresses);
  const primaryPhone = findPrimary<PhoneInfo>(contact.phones);
  const primaryEmail = findPrimary<EmailInfo>(contact.emails);

  const base: Pick<InvoiceCustomer, 'contactId' | 'address' | 'city' | 'postalCode' | 'country' | 'email'> = {
    contactId: contact.id ?? null,
    address: extractStreet(primaryAddress) || null,
    city: primaryAddress?.city ?? null,
    postalCode: primaryAddress?.postalCode ?? null,
    country: primaryAddress?.country ?? 'GR',
    email: primaryEmail?.email ?? null,
  };

  if (isIndividualContact(contact)) {
    return {
      ...base,
      name: `${contact.firstName} ${contact.lastName}`.trim(),
      vatNumber: contact.vatNumber ?? null,
      taxOffice: contact.taxOffice ?? null,
    };
  }

  if (isCompanyContact(contact)) {
    return {
      ...base,
      name: contact.companyName,
      vatNumber: contact.vatNumber ?? null,
      taxOffice: contact.taxOffice ?? null,
    };
  }

  // ServiceContact
  return {
    ...base,
    name: contact.serviceName,
    vatNumber: null,
    taxOffice: null,
  };
}

// ============================================================================
// COMPONENT
// ============================================================================

export function CustomerSelector({ customer, onCustomerChange }: CustomerSelectorProps) {
  const { t } = useTranslation('accounting');
  const [selectedContactId, setSelectedContactId] = useState(customer.contactId ?? '');
  const [autoFillMessage, setAutoFillMessage] = useState<string | null>(null);

  const updateField = (field: keyof InvoiceCustomer, value: string | null) => {
    onCustomerChange({ ...customer, [field]: value || null });
  };

  /**
   * Handle contact selection → fetch full details → auto-fill customer fields
   */
  const handleContactAutoFill = useCallback(async (contact: ContactSummary | null) => {
    if (!contact) {
      setSelectedContactId('');
      setAutoFillMessage(null);
      return;
    }

    setSelectedContactId(contact.id);

    try {
      const fullContact = await ContactsService.getContact(contact.id);
      if (!fullContact) {
        setAutoFillMessage(t('setup.contactAutoFillError'));
        return;
      }

      const mapped = mapContactToCustomer(fullContact);
      onCustomerChange(mapped);
      setAutoFillMessage(t('setup.contactAutoFilled'));
      setTimeout(() => setAutoFillMessage(null), 3000);
    } catch {
      console.error('Customer auto-fill failed for id:', contact.id);
      setAutoFillMessage(t('setup.contactAutoFillError'));
    }
  }, [onCustomerChange, t]);

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
            <p className="text-sm text-muted-foreground">{autoFillMessage}</p>
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
          <Label htmlFor="customerVat">ΑΦΜ</Label>
          <Input
            id="customerVat"
            value={customer.vatNumber ?? ''}
            onChange={(e) => updateField('vatNumber', e.target.value)}
          />
        </fieldset>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <fieldset>
          <Label htmlFor="customerTaxOffice">ΔΟΥ</Label>
          <Input
            id="customerTaxOffice"
            value={customer.taxOffice ?? ''}
            onChange={(e) => updateField('taxOffice', e.target.value)}
          />
        </fieldset>

        <fieldset>
          <Label htmlFor="customerAddress">Διεύθυνση</Label>
          <Input
            id="customerAddress"
            value={customer.address ?? ''}
            onChange={(e) => updateField('address', e.target.value)}
          />
        </fieldset>

        <fieldset>
          <Label htmlFor="customerCity">Πόλη</Label>
          <Input
            id="customerCity"
            value={customer.city ?? ''}
            onChange={(e) => updateField('city', e.target.value)}
          />
        </fieldset>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <fieldset>
          <Label htmlFor="customerPostalCode">ΤΚ</Label>
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
