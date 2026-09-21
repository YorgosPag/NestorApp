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

import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ContactSearchManager } from '@/components/contacts/relationships/ContactSearchManager';
import { DoyPicker } from '@/components/ui/doy-picker';
import type { Contact } from '@/types/contacts';
import { extractContactParty } from '../../utils/contact-party';
import { useContactAutoFill } from '../../hooks/useContactAutoFill';
import { EscoOccupationPicker } from '@/components/shared/EscoOccupationPicker';
import type { EscoPickerValue } from '@/types/contacts/esco-types';
import { useVatUniqueness } from '@/hooks/useVatUniqueness';
import type { CompanySetupInput } from '../../types';

import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';

import { cn } from '@/lib/utils';

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
 * Επαφή → στοιχεία εταιρείας. Η εξαγωγή είναι SSoT (`extractContactParty`)· εδώ μόνο τα πεδία.
 * Δημόσια υπηρεσία: ΑΦΜ / ΔΟΥ / επάγγελμα **δεν** αγγίζονται (μένει ό,τι έγραψε ο άνθρωπος).
 */
function mapContactToSetupFields(contact: Contact): Partial<CompanySetupInput> {
  const party = extractContactParty(contact);
  const fields: Partial<CompanySetupInput> = {
    businessName: party.name,
    address: party.street,
    city: party.city ?? '',
    postalCode: party.postalCode ?? '',
    phone: party.phone,
    email: party.email,
  };
  if (!party.hasTaxIdentity) return fields;
  return {
    ...fields,
    profession: party.profession ?? '',
    vatNumber: party.vatNumber ?? '',
    taxOffice: party.taxOffice ?? '',
  };
}

// ============================================================================
// COMPONENT
// ============================================================================

export function BasicInfoSection({ data, onChange, errors }: BasicInfoSectionProps) {
  const { t } = useTranslation(['accounting', 'accounting-setup', 'accounting-tax-offices']);
  const colors = useSemanticColors();
  const applyContact = useCallback(
    (contact: Contact) => onChange(mapContactToSetupFields(contact)),
    [onChange],
  );
  const { selectedContactId, autoFillMessage, handleContactAutoFill } = useContactAutoFill(applyContact);
  const { result: vatResult } = useVatUniqueness(data.vatNumber);

  /**
   * Handle ESCO profession picker change → update profession field
   */
  const handleProfessionChange = useCallback((escoValue: EscoPickerValue) => {
    onChange({ profession: escoValue.profession });
  }, [onChange]);


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
                <p className={cn("text-sm", colors.text.muted)}>{autoFillMessage}</p>
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
              <Label>{t('setup.profession')} *</Label>
              <EscoOccupationPicker
                value={data.profession}
                onChange={handleProfessionChange}
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
              {vatResult && !vatResult.isUnique && vatResult.existingContact && (
                <p className="mt-1 text-xs text-destructive font-medium" role="alert">
                  {t('setup.vatDuplicateWarning', { contactName: vatResult.existingContact.name })
                    .replace('{{contactName}}', vatResult.existingContact.name)}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="taxOffice">{t('setup.taxOffice')} *</Label>
              <DoyPicker
                id="taxOffice"
                value={data.taxOffice}
                onValueChange={(value) => onChange({ taxOffice: value })}
                error={errors.taxOffice}
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
