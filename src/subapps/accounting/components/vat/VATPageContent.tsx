'use client';

/**
 * @fileoverview VAT Page Content — Διαχείριση ΦΠΑ
 * @description UnifiedDashboard stats + quarterly cards + annual summary + deductibility
 * @author Claude Code (Anthropic AI) + Γιώργος Παγώνης
 * @created 2026-02-09
 * @updated 2026-02-10 — Added UnifiedDashboard for annual VAT stats
 * @see ADR-ACC-004 VAT Engine
 * @compliance CLAUDE.md Enterprise Standards — zero `any`, no inline styles
 */

import { useState, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  DollarSign,
  ArrowUpRight,
  ArrowDownRight,
  TrendingUp,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Spinner } from '@/components/ui/spinner';
import { UnifiedDashboard } from '@/components/property-management/dashboard/UnifiedDashboard';
import type { DashboardStat } from '@/components/property-management/dashboard/UnifiedDashboard';
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
// HELPERS
// ============================================================================

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('el-GR', { style: 'currency', currency: 'EUR' }).format(amount);
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

  // Compute dashboard stats from VAT summary
  const dashboardStats: DashboardStat[] = useMemo(() => {
    if (!annualSummary) {
      return [
        { title: t('dashboard.outputVat'), value: '—', icon: ArrowUpRight, color: 'blue' as const, loading },
        { title: t('dashboard.inputVat'), value: '—', icon: ArrowDownRight, color: 'green' as const, loading },
        { title: t('dashboard.vatPayable'), value: '—', icon: DollarSign, color: 'orange' as const, loading },
        { title: t('dashboard.vatCredit'), value: '—', icon: TrendingUp, color: 'gray' as const, loading },
      ];
    }

    const outputVat = annualSummary.annualOutputVat ?? 0;
    const inputVat = annualSummary.annualDeductibleInputVat ?? 0;
    const vatPayable = annualSummary.annualVatPayable ?? 0;
    const vatCredit = annualSummary.annualVatCredit ?? 0;

    return [
      {
        title: t('dashboard.outputVat'),
        value: formatCurrency(outputVat),
        icon: ArrowUpRight,
        color: 'blue' as const,
        loading,
      },
      {
        title: t('dashboard.inputVat'),
        value: formatCurrency(inputVat),
        icon: ArrowDownRight,
        color: 'green' as const,
        loading,
      },
      {
        title: t('dashboard.vatPayable'),
        value: formatCurrency(vatPayable),
        icon: DollarSign,
        color: vatPayable > 0 ? 'red' as const : 'green' as const,
        loading,
      },
      {
        title: t('dashboard.vatCredit'),
        value: formatCurrency(vatCredit),
        icon: TrendingUp,
        color: vatCredit > 0 ? 'green' as const : 'gray' as const,
        loading,
      },
    ];
  }, [annualSummary, loading, t]);

  return (
    <main className="min-h-screen bg-background">
      {/* Page Header */}
      <header className="border-b border-border bg-card p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">{t('vat.title')}</h1>
            <p className="text-sm text-muted-foreground mt-1">{t('vat.description')}</p>
          </div>
          <div className="w-32">
            <FiscalYearPicker value={fiscalYear} onValueChange={handleYearChange} />
          </div>
        </div>
      </header>

      {/* Stats Dashboard */}
      <UnifiedDashboard stats={dashboardStats} columns={4} />

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
