'use client';

/**
 * @fileoverview Company Setup — Fiscal Info Section
 * @description Φορολογικές ρυθμίσεις: Βιβλία, ΦΠΑ, ΕΦΚΑ
 * @author Claude Code (Anthropic AI) + Γιώργος Παγώνης
 * @created 2026-02-09
 * @version 1.0.0
 * @see ADR-ACC-000 §2 Company Data
 * @compliance CLAUDE.md Enterprise Standards — zero `any`, no inline styles, semantic HTML, ADR-001 Radix Select
 */

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
import type { CompanySetupInput } from '../../types';

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
  const { t } = useTranslation('accounting');

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
                onValueChange={(value) =>
                  onChange({ vatRegime: value as 'normal' | 'exempt' })
                }
              >
                <SelectTrigger id="vatRegime">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="normal">
                    {t('setup.vatRegimes.normal')}
                  </SelectItem>
                  <SelectItem value="exempt">
                    {t('setup.vatRegimes.exempt')}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Row 2: Λήξη Φ.Ε. + Κατηγορία ΕΦΚΑ */}
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
          </div>
        </fieldset>
      </CardContent>
    </Card>
  );
}
