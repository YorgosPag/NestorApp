'use client';

/**
 * @fileoverview Company Setup — Basic Info Section with Contact Autocomplete
 * @description Βασικά στοιχεία επιχείρησης: Επωνυμία (autocomplete από επαφές), ΑΦΜ, ΔΟΥ, Διεύθυνση, Επικοινωνία
 * @author Claude Code (Anthropic AI) + Γιώργος Παγώνης
 * @created 2026-02-09
 * @updated 2026-02-10
 * @version 1.1.0 — Added contact autocomplete for auto-fill
 * @see ADR-ACC-000 §2 Company Data
 * @compliance CLAUDE.md Enterprise Standards — zero `any`, no inline styles, semantic HTML
 */

import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import type { CompanySetupInput } from '../../types';

// ============================================================================
// TYPES
// ============================================================================

interface BasicInfoSectionProps {
  data: CompanySetupInput;
  onChange: (updates: Partial<CompanySetupInput>) => void;
  errors: Record<string, string>;
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Βρίσκει το primary item σε array (isPrimary === true), αλλιώς fallback στο πρώτο
 */
function findPrimary<T extends { isPrimary: boolean }>(items: T[] | undefined): T | undefined {
  if (!items || items.length === 0) return undefined;
  return items.find((item) => item.isPrimary) ?? items[0];
}

/**
 * Εξάγει address street (οδός + αριθμός) από AddressInfo
 */
function extractStreet(addr: AddressInfo | undefined): string {
  if (!addr) return '';
  return addr.number ? `${addr.street} ${addr.number}` : addr.street;
}

/**
 * Map full Contact → partial CompanySetupInput fields
 */
function mapContactToSetupFields(contact: Contact): Partial<CompanySetupInput> {
  const primaryAddress = findPrimary<AddressInfo>(contact.addresses);
  const primaryPhone = findPrimary<PhoneInfo>(contact.phones);
  const primaryEmail = findPrimary<EmailInfo>(contact.emails);

  if (isIndividualContact(contact)) {
    return {
      businessName: `${contact.firstName} ${contact.lastName}`.trim(),
      profession: contact.profession ?? '',
      vatNumber: contact.vatNumber ?? '',
      taxOffice: contact.taxOffice ?? '',
      address: extractStreet(primaryAddress),
      city: primaryAddress?.city ?? '',
      postalCode: primaryAddress?.postalCode ?? '',
      phone: primaryPhone?.number ?? null,
      email: primaryEmail?.email ?? null,
    };
  }

  if (isCompanyContact(contact)) {
    return {
      businessName: contact.companyName,
      profession: '',
      vatNumber: contact.vatNumber ?? '',
      taxOffice: contact.taxOffice ?? '',
      address: extractStreet(primaryAddress),
      city: primaryAddress?.city ?? '',
      postalCode: primaryAddress?.postalCode ?? '',
      phone: primaryPhone?.number ?? null,
      email: primaryEmail?.email ?? null,
    };
  }

  // ServiceContact
  return {
    businessName: contact.serviceName,
    address: extractStreet(primaryAddress),
    city: primaryAddress?.city ?? '',
    postalCode: primaryAddress?.postalCode ?? '',
    phone: primaryPhone?.number ?? null,
    email: primaryEmail?.email ?? null,
  };
}

// ============================================================================
// COMPONENT
// ============================================================================

export function BasicInfoSection({ data, onChange, errors }: BasicInfoSectionProps) {
  const { t } = useTranslation('accounting');
  const [selectedContactId, setSelectedContactId] = useState('');
  const [autoFillMessage, setAutoFillMessage] = useState<string | null>(null);

  /**
   * Handle contact selection → fetch full details → auto-fill fields
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

      const fields = mapContactToSetupFields(fullContact);
      onChange(fields);
      setAutoFillMessage(t('setup.contactAutoFilled'));

      // Clear success message after 3 seconds
      setTimeout(() => setAutoFillMessage(null), 3000);
    } catch {
      console.error('Contact auto-fill failed for id:', contact.id);
      setAutoFillMessage(t('setup.contactAutoFillError'));
    }
  }, [onChange, t]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('setup.basicInfo')}</CardTitle>
      </CardHeader>
      <CardContent>
        <fieldset className="space-y-4">
          {/* Row 1: Επωνυμία (autocomplete) + Επάγγελμα */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{t('setup.businessName')} *</Label>
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
              {/* Editable fallback — πάντα ορατό, χρήστης μπορεί να αλλάξει μετά auto-fill */}
              <Input
                id="businessName"
                value={data.businessName}
                onChange={(e) => onChange({ businessName: e.target.value })}
                placeholder={t('setup.businessName')}
                aria-invalid={!!errors.businessName}
              />
              {errors.businessName && (
                <p className="text-sm text-destructive">{errors.businessName}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="profession">{t('setup.profession')} *</Label>
              <Input
                id="profession"
                value={data.profession}
                onChange={(e) => onChange({ profession: e.target.value })}
                placeholder={t('setup.profession')}
              />
            </div>
          </div>

          {/* Row 2: ΑΦΜ + ΔΟΥ */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="vatNumber">{t('setup.vatNumber')} *</Label>
              <Input
                id="vatNumber"
                value={data.vatNumber}
                onChange={(e) => onChange({ vatNumber: e.target.value })}
                placeholder="123456789"
                maxLength={9}
                aria-invalid={!!errors.vatNumber}
              />
              {errors.vatNumber && (
                <p className="text-sm text-destructive">{errors.vatNumber}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="taxOffice">{t('setup.taxOffice')} *</Label>
              <Input
                id="taxOffice"
                value={data.taxOffice}
                onChange={(e) => onChange({ taxOffice: e.target.value })}
                placeholder={t('setup.taxOffice')}
                aria-invalid={!!errors.taxOffice}
              />
              {errors.taxOffice && (
                <p className="text-sm text-destructive">{errors.taxOffice}</p>
              )}
            </div>
          </div>

          {/* Row 3: Διεύθυνση */}
          <div className="space-y-2">
            <Label htmlFor="address">{t('setup.address')} *</Label>
            <Input
              id="address"
              value={data.address}
              onChange={(e) => onChange({ address: e.target.value })}
              placeholder={t('setup.address')}
            />
          </div>

          {/* Row 4: Πόλη + ΤΚ */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="city">{t('setup.city')} *</Label>
              <Input
                id="city"
                value={data.city}
                onChange={(e) => onChange({ city: e.target.value })}
                placeholder={t('setup.city')}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="postalCode">{t('setup.postalCode')} *</Label>
              <Input
                id="postalCode"
                value={data.postalCode}
                onChange={(e) => onChange({ postalCode: e.target.value })}
                placeholder="12345"
                maxLength={5}
              />
            </div>
          </div>

          {/* Row 5: Τηλέφωνο + Email */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="phone">{t('setup.phone')}</Label>
              <Input
                id="phone"
                type="tel"
                value={data.phone ?? ''}
                onChange={(e) => onChange({ phone: e.target.value || null })}
                placeholder="+30 210 1234567"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">{t('setup.email')}</Label>
              <Input
                id="email"
                type="email"
                value={data.email ?? ''}
                onChange={(e) => onChange({ email: e.target.value || null })}
                placeholder="info@company.gr"
              />
            </div>
          </div>
        </fieldset>
      </CardContent>
    </Card>
  );
}
