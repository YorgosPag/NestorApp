'use client';

/**
 * @fileoverview VAT Page Content — Διαχείριση ΦΠΑ
 * @description AccountingPageHeader + UnifiedDashboard toggle + AdvancedFiltersPanel (quarter) + quarterly cards + annual summary + deductibility
 * @author Claude Code (Anthropic AI) + Γιώργος Παγώνης
 * @created 2026-02-09
 * @updated 2026-02-10 — Collapsible dashboard via AccountingPageHeader + quarter filter
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
import { AdvancedFiltersPanel } from '@/components/core/AdvancedFilters/AdvancedFiltersPanel';
import type { FilterPanelConfig, GenericFilterState } from '@/components/core/AdvancedFilters/types';
import { formatCurrency } from '../../utils/format';
import { AccountingPageHeader } from '../shared/AccountingPageHeader';
import { useVATSummary } from '../../hooks/useVATSummary';
import type { VATAnnualSummary } from '@/subapps/accounting/types';
import { FiscalYearPicker } from '../shared/FiscalYearPicker';
import { VATQuarterCards } from './VATQuarterCards';
import { VATSummaryCard } from './VATSummaryCard';
import { VATDeductibilityTable } from './VATDeductibilityTable';

// ============================================================================
// TYPES
// ============================================================================

interface VATFilterState extends GenericFilterState {
  quarter: string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const DEFAULT_FILTERS: VATFilterState = {
  quarter: 'all',
};

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

function buildFilterConfig(t: (key: string) => string): FilterPanelConfig {
  return {
    title: 'filters.title',
    i18nNamespace: 'accounting',
    rows: [
      {
        id: 'vat-main',
        fields: [
          {
            id: 'quarter',
            type: 'select',
            label: 'filterLabels.quarter',
            ariaLabel: 'Quarter',
            width: 1,
            options: [
              { value: 'all', label: t('filterOptions.allQuarters') },
              { value: 'Q1', label: 'Q1 — ' + t('common.months.1') + '-' + t('common.months.3') },
              { value: 'Q2', label: 'Q2 — ' + t('common.months.4') + '-' + t('common.months.6') },
              { value: 'Q3', label: 'Q3 — ' + t('common.months.7') + '-' + t('common.months.9') },
              { value: 'Q4', label: 'Q4 — ' + t('common.months.10') + '-' + t('common.months.12') },
            ],
          },
        ],
      },
    ],
  };
}

// ============================================================================
// COMPONENT
// ============================================================================

export function VATPageContent() {
  const { t } = useTranslation('accounting');

  const [fiscalYear, setFiscalYear] = useState<number>(new Date().getFullYear());
  const [showDashboard, setShowDashboard] = useState(true);
  const [filters, setFilters] = useState<VATFilterState>({ ...DEFAULT_FILTERS });

  const filterConfig = useMemo(() => buildFilterConfig(t), [t]);

  const { summary, loading, error, refetch } = useVATSummary({ fiscalYear });

  const handleYearChange = useCallback((year: number) => {
    setFiscalYear(year);
  }, []);

  const annualSummary = isAnnualSummary(summary) ? summary : null;

  // Filter quarters based on selected quarter filter
  const filteredQuarters = useMemo(() => {
    if (!annualSummary) return [];
    if (filters.quarter === 'all') return annualSummary.quarters;
    const quarterNumber = parseInt(filters.quarter.replace('Q', ''), 10);
    return annualSummary.quarters.filter((q) => q.quarter === quarterNumber);
  }, [annualSummary, filters.quarter]);

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
      <AccountingPageHeader
        icon={DollarSign}
        titleKey="vat.title"
        descriptionKey="vat.description"
        showDashboard={showDashboard}
        onDashboardToggle={() => setShowDashboard(!showDashboard)}
        actions={[
          <div key="fiscal-year" className="w-32">
            <FiscalYearPicker value={fiscalYear} onValueChange={handleYearChange} />
          </div>,
        ]}
      />

      {/* Stats Dashboard */}
      {showDashboard && <UnifiedDashboard stats={dashboardStats} columns={4} />}

      {/* Quarter Filter */}
      <AdvancedFiltersPanel
        config={filterConfig}
        filters={filters}
        onFiltersChange={setFilters}
        defaultFilters={DEFAULT_FILTERS}
      />

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
                quarters={filteredQuarters}
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
