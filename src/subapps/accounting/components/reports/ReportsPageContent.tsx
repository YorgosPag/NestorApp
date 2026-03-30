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
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { UnifiedDashboard } from '@/components/property-management/dashboard/UnifiedDashboard';
import type { DashboardStat } from '@/components/property-management/dashboard/UnifiedDashboard';
import { formatCurrency } from '../../utils/format';
import { AccountingPageHeader } from '../shared/AccountingPageHeader';
import { FiscalYearPicker } from '../shared/FiscalYearPicker';
import { PageLoadingState } from '@/core/states';
import { useTaxEstimate } from '../../hooks/useTaxEstimate';
import { VATReportCard } from './VATReportCard';
import { TaxEstimateCard } from './TaxEstimateCard';
import { TaxDashboard } from './TaxDashboard';
import { PartnerTaxBreakdown } from '../tax/PartnerTaxBreakdown';
import { CorporateTaxBreakdown } from '../tax/CorporateTaxBreakdown';
import { FinancialReportsDashboard } from './FinancialReportsDashboard';

// ============================================================================
// COMPONENT
// ============================================================================

export function ReportsPageContent() {
  const { t } = useTranslation('accounting');

  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [showDashboard, setShowDashboard] = useState(true);

  const { estimate, partnershipResult, corporateResult, entityType, loading } = useTaxEstimate({ fiscalYear: selectedYear });

  // Dashboard stats — entity-aware (useMemo MUST be above early return — React hooks rule)
  const dashboardStats: DashboardStat[] = useMemo(() => {
    if ((entityType === 'epe' || entityType === 'ae') && corporateResult) {
      return [
        {
          title: t('reports.totalIncome'),
          value: formatCurrency(corporateResult.corporateTax.grossIncome),
          icon: TrendingUp,
          color: 'green' as const,
          loading,
        },
        {
          title: t('reports.totalExpenses'),
          value: formatCurrency(corporateResult.corporateTax.deductibleExpenses),
          icon: TrendingDown,
          color: 'red' as const,
          loading,
        },
        {
          title: t('reports.taxableIncome'),
          value: formatCurrency(corporateResult.corporateTax.taxableIncome),
          icon: Calculator,
          color: 'blue' as const,
          loading,
        },
        {
          title: t('setup.corporateTax.totalObligation', { defaultValue: 'Φορολογική Υποχρέωση' }),
          value: formatCurrency(corporateResult.corporateTax.totalObligation),
          icon: DollarSign,
          color: 'orange' as const,
          loading,
        },
      ];
    }

    if (entityType === 'oe' && partnershipResult) {
      return [
        {
          title: t('reports.totalIncome'),
          value: formatCurrency(partnershipResult.totalEntityIncome),
          icon: TrendingUp,
          color: 'green' as const,
          loading,
        },
        {
          title: t('reports.totalExpenses'),
          value: formatCurrency(partnershipResult.totalEntityExpenses),
          icon: TrendingDown,
          color: 'red' as const,
          loading,
        },
        {
          title: t('reports.taxableIncome'),
          value: formatCurrency(partnershipResult.totalEntityProfit),
          icon: Calculator,
          color: 'blue' as const,
          loading,
        },
        {
          title: t('tax.partnerBreakdown.professionalTax'),
          value: formatCurrency(partnershipResult.entityProfessionalTax),
          icon: DollarSign,
          color: 'orange' as const,
          loading,
        },
      ];
    }

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
  }, [estimate, partnershipResult, corporateResult, entityType, loading, t]);

  // ADR-229 Phase 2: Data-level loading guard (AFTER useMemo to avoid hooks violation)
  if (loading) {
    return (
      <main className="min-h-screen bg-background">
        <PageLoadingState icon={FileBarChart} message={t('reports.loading', { defaultValue: 'Φόρτωση αναφορών...' })} layout="contained" />
      </main>
    );
  }

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

      {/* Tabbed Content: Tax/VAT + Financial Reports */}
      <Tabs defaultValue="tax" className="px-6 pt-4">
        <TabsList>
          <TabsTrigger value="tax">{t('reports.tabs.taxVat')}</TabsTrigger>
          <TabsTrigger value="financial">{t('reports.tabs.financialReports')}</TabsTrigger>
        </TabsList>

        <TabsContent value="tax">
          <section className="py-6 space-y-6">
            {entityType === 'oe' && partnershipResult ? (
              <PartnerTaxBreakdown result={partnershipResult} />
            ) : (entityType === 'epe' || entityType === 'ae') && corporateResult ? (
              <CorporateTaxBreakdown result={corporateResult} entityType={entityType} />
            ) : (
              <>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <VATReportCard fiscalYear={selectedYear} />
                  <TaxEstimateCard fiscalYear={selectedYear} />
                </div>
                <TaxDashboard fiscalYear={selectedYear} />
              </>
            )}
          </section>
        </TabsContent>

        <TabsContent value="financial">
          <FinancialReportsDashboard />
        </TabsContent>
      </Tabs>
    </main>
  );
}
