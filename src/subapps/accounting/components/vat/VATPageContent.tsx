/**
 * @fileoverview VAT Page Content — Κύρια σελίδα Διαχείρισης ΦΠΑ
 * @description Εμφανίζει header, FiscalYearPicker, 4 quarter cards, annual summary, deductibility table
 * @author Claude Code (Anthropic AI) + Γιώργος Παγώνης
 * @created 2026-02-09
 * @version 1.0.0
 * @see ADR-ACC-004 VAT Engine
 * @compliance CLAUDE.md Enterprise Standards — zero `any`, no inline styles
 */

'use client';

import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Spinner } from '@/components/ui/spinner';
import { useVATSummary } from '../../hooks/useVATSummary';
import type { VATAnnualSummary } from '@/subapps/accounting/types';
import { FiscalYearPicker } from '../shared/FiscalYearPicker';
import { VATQuarterCards } from './VATQuarterCards';
import { VATSummaryCard } from './VATSummaryCard';
import { VATDeductibilityTable } from './VATDeductibilityTable';

// ============================================================================
// TYPE GUARD
// ============================================================================

function isAnnualSummary(data: unknown): data is VATAnnualSummary {
  return (
    data !== null &&
    typeof data === 'object' &&
    'quarters' in data &&
    Array.isArray((data as VATAnnualSummary).quarters)
  );
}

// ============================================================================
// COMPONENT
// ============================================================================

export function VATPageContent() {
  const { t } = useTranslation('accounting');

  const [fiscalYear, setFiscalYear] = useState<number>(new Date().getFullYear());

  const { summary, loading, error, refetch } = useVATSummary({ fiscalYear });

  const handleYearChange = useCallback((year: number) => {
    setFiscalYear(year);
  }, []);

  const annualSummary = isAnnualSummary(summary) ? summary : null;

  return (
    <main className="min-h-screen bg-background">
      {/* Page Header */}
      <header className="border-b border-border bg-card p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">{t('vat.title')}</h1>
            <p className="text-sm text-muted-foreground mt-1">{t('vat.description')}</p>
          </div>
        </div>
        <nav className="flex gap-3" aria-label={t('common.filter')}>
          <div className="w-32">
            <FiscalYearPicker value={fiscalYear} onValueChange={handleYearChange} />
          </div>
        </nav>
      </header>

      {/* Content Area */}
      <section className="p-6 space-y-8">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Spinner size="large" />
          </div>
        ) : error ? (
          <div className="text-center py-12">
            <p className="text-destructive mb-2">{error}</p>
            <Button variant="outline" onClick={refetch}>
              {t('common.retry')}
            </Button>
          </div>
        ) : (
          <>
            {/* Quarterly Returns */}
            <section aria-labelledby="quarterly-heading">
              <h2 id="quarterly-heading" className="text-lg font-semibold text-foreground mb-4">
                {t('vat.quarterlyReturns')}
              </h2>
              <VATQuarterCards
                quarters={annualSummary?.quarters ?? []}
                fiscalYear={fiscalYear}
              />
            </section>

            <Separator />

            {/* Annual Summary */}
            {annualSummary && (
              <section aria-labelledby="annual-heading">
                <h2 id="annual-heading" className="text-lg font-semibold text-foreground mb-4">
                  {t('vat.annualSummary')}
                </h2>
                <div className="max-w-lg">
                  <VATSummaryCard summary={annualSummary} />
                </div>
              </section>
            )}

            <Separator />

            {/* VAT Deductibility Rules */}
            <section aria-labelledby="deductibility-heading">
              <h2 id="deductibility-heading" className="text-lg font-semibold text-foreground mb-4">
                {t('vat.deductibility')}
              </h2>
              <VATDeductibilityTable />
            </section>
          </>
        )}
      </section>
    </main>
  );
}
