'use client';

/**
 * @fileoverview Company Setup — Main Page Content
 * @description Κεντρική σελίδα ρύθμισης επιχείρησης (M-001 Company Setup)
 * @author Claude Code (Anthropic AI) + Γιώργος Παγώνης
 * @created 2026-02-09
 * @version 1.0.0
 * @see ADR-ACC-000 §2 Company Data
 * @compliance CLAUDE.md Enterprise Standards — zero `any`, no inline styles, semantic HTML
 */

import { useState, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { Save } from 'lucide-react';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { useCompanySetup } from '../../hooks/useCompanySetup';
import type { CompanySetupInput, KadEntry } from '../../types';
import { BasicInfoSection } from './BasicInfoSection';
import { FiscalInfoSection } from './FiscalInfoSection';
import { KadSection } from './KadSection';
import { InvoiceSeriesSection } from './InvoiceSeriesSection';

// ============================================================================
// DEFAULTS
// ============================================================================

function createDefaultData(): CompanySetupInput {
  const defaultKad: KadEntry = {
    code: '',
    description: '',
    type: 'primary',
    activeFrom: new Date().toISOString().split('T')[0],
  };

  return {
    businessName: '',
    profession: '',
    vatNumber: '',
    taxOffice: '',
    address: '',
    city: '',
    postalCode: '',
    phone: null,
    email: null,
    website: null,
    mainKad: defaultKad,
    secondaryKads: [],
    bookCategory: 'simplified',
    vatRegime: 'normal',
    fiscalYearEnd: 12,
    currency: 'EUR',
    efkaCategory: 1,
    invoiceSeries: [],
  };
}

// ============================================================================
// VALIDATION
// ============================================================================

function validateForm(data: CompanySetupInput): Record<string, string> {
  const errors: Record<string, string> = {};

  if (!data.businessName.trim()) {
    errors.businessName = 'validation.businessNameRequired';
  }
  if (!data.vatNumber.trim()) {
    errors.vatNumber = 'validation.vatNumberRequired';
  } else if (!/^\d{9}$/.test(data.vatNumber.trim())) {
    errors.vatNumber = 'validation.vatNumberInvalid';
  }
  if (!data.taxOffice.trim()) {
    errors.taxOffice = 'validation.taxOfficeRequired';
  }
  if (!data.mainKad.code.trim()) {
    errors.mainKad = 'validation.mainKadRequired';
  }

  return errors;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function SetupPageContent() {
  const { t } = useTranslation('accounting');
  const { profile, loading, saving, error, saveSetup } = useCompanySetup();
  const colors = useSemanticColors();

  const [formData, setFormData] = useState<CompanySetupInput>(createDefaultData);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Sync profile → formData when loaded
  useEffect(() => {
    if (profile) {
      const { createdAt: _c, updatedAt: _u, ...rest } = profile;
      setFormData(rest);
    }
  }, [profile]);

  const handleChange = useCallback((updates: Partial<CompanySetupInput>) => {
    setFormData((prev) => ({ ...prev, ...updates }));
    // Clear validation errors for updated fields
    setValidationErrors((prev) => {
      const next = { ...prev };
      for (const key of Object.keys(updates)) {
        delete next[key];
      }
      return next;
    });
    setSaveSuccess(false);
  }, []);

  const handleSave = useCallback(async () => {
    const errors = validateForm(formData);
    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      return;
    }

    setValidationErrors({});
    const success = await saveSetup(formData);
    if (success) {
      setSaveSuccess(true);
      // Auto-dismiss success after 3 seconds
      setTimeout(() => setSaveSuccess(false), 3000);
    }
  }, [formData, saveSetup]);

  // Translate validation errors
  const translatedErrors: Record<string, string> = {};
  for (const [key, value] of Object.entries(validationErrors)) {
    translatedErrors[key] = t(`setup.${value}`);
  }

  return (
    <main className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">{t('setup.title')}</h1>
            <p className="text-sm text-muted-foreground mt-1">{t('setup.description')}</p>
          </div>
          <Button onClick={handleSave} disabled={saving || loading}>
            {saving ? (
              <Spinner size="small" className="mr-2" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            {t('setup.save')}
          </Button>
        </div>
      </header>

      {/* Content */}
      <section className="p-6 space-y-6 max-w-4xl">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Spinner size="large" />
          </div>
        ) : (
          <>
            {/* Success message */}
            {saveSuccess && (
              <div
                role="status"
                className={`rounded-md border ${colors.border.success} ${colors.bg.successSubtle} p-3 text-sm ${colors.text.success}`}
              >
                {t('setup.saveSuccess')}
              </div>
            )}

            {/* Error message */}
            {error && (
              <div
                role="alert"
                className="rounded-md border border-destructive/50 bg-destructive/5 p-3 text-sm text-destructive"
              >
                {t('setup.saveError')}: {error}
              </div>
            )}

            {/* Sections */}
            <BasicInfoSection data={formData} onChange={handleChange} errors={translatedErrors} />
            <FiscalInfoSection data={formData} onChange={handleChange} />
            <KadSection data={formData} onChange={handleChange} errors={translatedErrors} />
            <InvoiceSeriesSection data={formData} onChange={handleChange} />

            {/* Footer Save Button */}
            <footer className="flex justify-end pt-4">
              <Button onClick={handleSave} disabled={saving || loading} size="lg">
                {saving ? (
                  <Spinner size="small" className="mr-2" />
                ) : (
                  <Save className="mr-2 h-4 w-4" />
                )}
                {t('setup.save')}
              </Button>
            </footer>
          </>
        )}
      </section>
    </main>
  );
}


