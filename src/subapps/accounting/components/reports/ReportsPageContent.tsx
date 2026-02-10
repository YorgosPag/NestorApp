'use client';

/**
 * @fileoverview Accounting Subapp — Reports Page Content
 * @description AccountingPageHeader + UnifiedDashboard (tax overview stats) + report cards
 * @author Claude Code (Anthropic AI) + Georgios Pagonis
 * @created 2026-02-09
 * @updated 2026-02-10 — Collapsible dashboard via AccountingPageHeader + tax overview stats
 * @see ADR-ACC-004 VAT Engine, ADR-ACC-009 Tax Engine
 * @compliance CLAUDE.md Enterprise Standards — zero `any`, no inline styles, semantic HTML
 */

import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  FileBarChart,
  TrendingUp,
  TrendingDown,
  Calculator,
  DollarSign,
} from 'lucide-react';
import { UnifiedDashboard } from '@/components/property-management/dashboard/UnifiedDashboard';
import type { DashboardStat } from '@/components/property-management/dashboard/UnifiedDashboard';
import { formatCurrency } from '../../utils/format';
import { AccountingPageHeader } from '../shared/AccountingPageHeader';
import { FiscalYearPicker } from '../shared/FiscalYearPicker';
import { useTaxEstimate } from '../../hooks/useTaxEstimate';
import { VATReportCard } from './VATReportCard';
import { TaxEstimateCard } from './TaxEstimateCard';
import { TaxDashboard } from './TaxDashboard';

// ============================================================================
// COMPONENT
// ============================================================================

export function ReportsPageContent() {
  const { t } = useTranslation('accounting');

  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [showDashboard, setShowDashboard] = useState(true);

  const { estimate, loading } = useTaxEstimate({ fiscalYear: selectedYear });

  // Dashboard stats from tax estimate
  const dashboardStats: DashboardStat[] = useMemo(() => {
    const income = estimate?.actualIncome ?? 0;
    const expenses = estimate?.actualExpenses ?? 0;
    const taxableIncome = (estimate?.projectedAnnualIncome ?? 0) - (estimate?.projectedAnnualExpenses ?? 0);
    const estimatedTax = estimate?.projectedAnnualTax ?? 0;

    return [
      {
        title: t('reports.totalIncome'),
        value: estimate ? formatCurrency(income) : '—',
        icon: TrendingUp,
        color: 'green' as const,
        loading,
      },
      {
        title: t('reports.totalExpenses'),
        value: estimate ? formatCurrency(expenses) : '—',
        icon: TrendingDown,
        color: 'red' as const,
        loading,
      },
      {
        title: t('reports.taxableIncome'),
        value: estimate ? formatCurrency(taxableIncome) : '—',
        icon: Calculator,
        color: 'blue' as const,
        loading,
      },
      {
        title: t('reports.estimatedTax'),
        value: estimate ? formatCurrency(estimatedTax) : '—',
        icon: DollarSign,
        color: 'orange' as const,
        loading,
      },
    ];
  }, [estimate, loading, t]);

  return (
    <main className="min-h-screen bg-background">
      {/* Header */}
      <AccountingPageHeader
        icon={FileBarChart}
        titleKey="reports.title"
        descriptionKey="reports.description"
        showDashboard={showDashboard}
        onDashboardToggle={() => setShowDashboard(!showDashboard)}
        actions={[
          <div key="fiscal-year" className="w-32">
            <FiscalYearPicker value={selectedYear} onValueChange={setSelectedYear} />
          </div>,
        ]}
      />

      {/* Stats Dashboard */}
      {showDashboard && <UnifiedDashboard stats={dashboardStats} columns={4} />}

      {/* Report Cards Grid */}
      <section className="p-6 space-y-6">
        {/* Top Row: VAT and Tax Estimate */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <VATReportCard fiscalYear={selectedYear} />
          <TaxEstimateCard fiscalYear={selectedYear} />
        </div>

        {/* Bottom Row: Tax Dashboard (full width) */}
        <TaxDashboard fiscalYear={selectedYear} />
      </section>
    </main>
  );
}
