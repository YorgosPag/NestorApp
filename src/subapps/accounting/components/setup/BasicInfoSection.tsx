'use client';

/**
 * @fileoverview Company Setup — Basic Info Section
 * @description Βασικά στοιχεία επιχείρησης: Επωνυμία, ΑΦΜ, ΔΟΥ, Διεύθυνση, Επικοινωνία
 * @author Claude Code (Anthropic AI) + Γιώργος Παγώνης
 * @created 2026-02-09
 * @version 1.0.0
 * @see ADR-ACC-000 §2 Company Data
 * @compliance CLAUDE.md Enterprise Standards — zero `any`, no inline styles, semantic HTML
 */

import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
// COMPONENT
// ============================================================================

export function BasicInfoSection({ data, onChange, errors }: BasicInfoSectionProps) {
  const { t } = useTranslation('accounting');

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('setup.basicInfo')}</CardTitle>
      </CardHeader>
      <CardContent>
        <fieldset className="space-y-4">
          {/* Row 1: Επωνυμία + Επάγγελμα */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="businessName">{t('setup.businessName')} *</Label>
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
