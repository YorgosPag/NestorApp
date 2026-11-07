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
import { formatAccountingCurrency } from '../../utils/format';
import { roundToTwo } from '../../utils/math';
import { AccountingPageHeader } from '../shared/AccountingPageHeader';
import { FiscalYearPicker } from '../shared/FiscalYearPicker';
import { PageLoadingState } from '@/core/states';
import { useTaxEstimate } from '../../hooks/useTaxEstimate';
import { VATReportCard } from './VATReportCard';
import { TaxEstimateCard } from './TaxEstimateCard';
import { TaxDashboard } from './TaxDashboard';
import { CorporateTaxBreakdown } from '../tax/CorporateTaxBreakdown';
import { FinancialReportsDashboard } from './FinancialReportsDashboard';

// ============================================================================
// COMPONENT
// ============================================================================

export function ReportsPageContent() {
  const { t } = useTranslation(['accounting', 'accounting-tax-offices']);

  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [showDashboard, setShowDashboard] = useState(true);

  const { estimate, partnershipResult, corporateResult, entityType, loading } = useTaxEstimate({ fiscalYear: selectedYear });

  // Dashboard stats — entity-aware (useMemo MUST be above early return — React hooks rule)
  const dashboardStats: DashboardStat[] = useMemo(() => {
    // ΟΕ / ΕΠΕ / ΑΕ: ο ίδιος φόρος οντότητας (ADR-ACC-024 §6) — ίδια στατιστικά
    const entityTax = entityType === 'oe'
      ? partnershipResult?.corporateTax
      : (entityType === 'epe' || entityType === 'ae') ? corporateResult?.corporateTax : undefined;
    if (entityTax) {
      return [
        {
          title: t('reports.totalIncome'),
          value: formatAccountingCurrency(entityTax.grossIncome),
          icon: TrendingUp,
          color: 'green' as const,
          loading,
        },
        {
          title: t('reports.totalExpenses'),
          // ΟΛΑ τα έξοδα του βιβλίου (ίδια σημασία με την ατομική): η μηχανή παίρνει την ΕΦΚΑ χωριστά (ADR-ACC-006 §7.1)
          value: formatAccountingCurrency(roundToTwo(entityTax.deductibleExpenses + entityTax.efkaContributions)),
          icon: TrendingDown,
          color: 'red' as const,
          loading,
        },
        {
          title: t('reports.taxableIncome'),
          value: formatAccountingCurrency(entityTax.taxableIncome),
          icon: Calculator,
          color: 'blue' as const,
          loading,
        },
        {
          title: t('setup.corporateTax.totalObligation'),
          value: formatAccountingCurrency(entityTax.totalObligation),
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
        value: estimate ? formatAccountingCurrency(income) : '—',
        icon: TrendingUp,
        color: 'green' as const,
        loading,
      },
      {
        title: t('reports.totalExpenses'),
        value: estimate ? formatAccountingCurrency(expenses) : '—',
        icon: TrendingDown,
        color: 'red' as const,
        loading,
      },
      {
        title: t('reports.taxableIncome'),
        value: estimate ? formatAccountingCurrency(taxableIncome) : '—',
        icon: Calculator,
        color: 'blue' as const,
        loading,
      },
      {
        title: t('reports.estimatedTax'),
        value: estimate ? formatAccountingCurrency(estimatedTax) : '—',
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
        <PageLoadingState icon={FileBarChart} message={t('reports.loading')} layout="contained" />
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
              <CorporateTaxBreakdown entityType="oe" result={partnershipResult} />
            ) : entityType === 'epe' && corporateResult && 'memberDividends' in corporateResult ? (
              <CorporateTaxBreakdown entityType="epe" result={corporateResult} />
            ) : entityType === 'ae' && corporateResult && 'shareholderDividends' in corporateResult ? (
              <CorporateTaxBreakdown entityType="ae" result={corporateResult} />
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
