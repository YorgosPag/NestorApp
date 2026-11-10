'use client';

/**
 * @fileoverview Company Setup — Fiscal Info Section
 * @description Φορολογικές ρυθμίσεις: Βιβλία, ΦΠΑ, ΕΦΚΑ, Έναρξη εργασιών
 * @author Claude Code (Anthropic AI) + Γιώργος Παγώνης
 * @created 2026-02-09
 * @version 1.0.0
 * @see ADR-ACC-000 §2 Company Data
 * @compliance CLAUDE.md Enterprise Standards — zero `any`, no inline styles, semantic HTML, ADR-001 Radix Select
 */

import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { cn } from '@/lib/utils';
import type { CompanySetupInput } from '../../types';
import { COMPANY_VAT_REGIMES } from '../../types/company';
import { isCompanyVatRegime, withVatRegime } from '../../services/setup/company-vat-regime';
import { accountingToday } from '../../utils/accounting-day';
import { VatExemptionReasonField } from '../shared/VatExemptionReasonField';
import { BusinessStartFields } from './BusinessStartFields';

// ============================================================================
// TYPES
// ============================================================================

interface FiscalInfoSectionProps {
  data: CompanySetupInput;
  onChange: (updates: Partial<CompanySetupInput>) => void;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const EFKA_CATEGORIES = [1, 2, 3, 4, 5, 6] as const;

// ============================================================================
// COMPONENT
// ============================================================================

export function FiscalInfoSection({ data, onChange }: FiscalInfoSectionProps) {
  const { t } = useTranslation(['accounting', 'accounting-tax-offices']);
  const colors = useSemanticColors();
  const exemptionHintId = useId();

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('setup.fiscalInfo')}</CardTitle>
      </CardHeader>
      <CardContent>
        <fieldset className="space-y-4">
          {/* Row 1: Κατηγορία Βιβλίων + Καθεστώς ΦΠΑ */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="bookCategory">{t('setup.bookCategory')}</Label>
              <Select
                value={data.bookCategory}
                onValueChange={(value) =>
                  onChange({ bookCategory: value as 'simplified' | 'double_entry' })
                }
              >
                <SelectTrigger id="bookCategory">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="simplified">
                    {t('setup.bookCategories.simplified')}
                  </SelectItem>
                  <SelectItem value="double_entry">
                    {t('setup.bookCategories.double_entry')}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="vatRegime">{t('setup.vatRegime')}</Label>
              <Select
                value={data.vatRegime}
                onValueChange={(value) => {
                  if (!isCompanyVatRegime(value)) return;
                  const current = { vatRegime: data.vatRegime, vatExemptionCategory: data.vatExemptionCategory };
                  onChange(withVatRegime(current, value));
                }}
              >
                <SelectTrigger id="vatRegime">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {COMPANY_VAT_REGIMES.map((regime) => (
                    <SelectItem key={regime} value={regime}>
                      {t(`setup.vatRegimes.${regime}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* ADR-ACC-003 §22.4: ΠΟΙΑ απαλλαγή — η αφετηρία κάθε νέας γραμμής τιμολογίου */}
          {data.vatRegime === 'exempt' && (
            <section aria-describedby={exemptionHintId}>
              <VatExemptionReasonField
                id="companyVatExemption"
                value={data.vatExemptionCategory}
                issueDate={accountingToday()}
                onValueChange={(code) => onChange({ vatExemptionCategory: code })}
              />
              <p id={exemptionHintId} className={cn('mt-1 text-xs', colors.text.muted)}>
                {t('setup.vatExemptionDefaultHint')}
              </p>
            </section>
          )}

          {/* Row 2: Λήξη Φ.Ε. + Κατηγορία ΕΦΚΑ (sole_proprietor μόνο) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="fiscalYearEnd">{t('setup.fiscalYearEnd')}</Label>
              <Select
                value={String(data.fiscalYearEnd)}
                onValueChange={(value) =>
                  onChange({ fiscalYearEnd: parseInt(value, 10) })
                }
              >
                <SelectTrigger id="fiscalYearEnd">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((month) => (
                    <SelectItem key={month} value={String(month)}>
                      {t(`common.months.${month}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {data.entityType === 'sole_proprietor' && (
              <div className="space-y-2">
                <Label htmlFor="efkaCategory">{t('setup.efkaCategory')}</Label>
                <Select
                  value={String(data.efkaCategory)}
                  onValueChange={(value) =>
                    onChange({ efkaCategory: parseInt(value, 10) as 1 | 2 | 3 | 4 | 5 | 6 })
                  }
                >
                  <SelectTrigger id="efkaCategory">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {EFKA_CATEGORIES.map((cat) => (
                      <SelectItem key={cat} value={String(cat)}>
                        {t('setup.efkaCategoryLabel', { number: cat })}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          {/* Row 3: Έναρξη εργασιών — ρίζα της μειωμένης προκαταβολής (ADR-ACC-023 §1 · ADR-ACC-024 §6.1 α) */}
          <BusinessStartFields
            entityType={data.entityType}
            value={data.businessStart}
            onChange={(businessStart) => onChange({ businessStart })}
          />
        </fieldset>
      </CardContent>
    </Card>
  );
}
