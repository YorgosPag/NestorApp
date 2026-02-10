'use client';

/**
 * @fileoverview EFKA Page Content — Εισφορές ΕΦΚΑ
 * @description AccountingPageHeader + UnifiedDashboard toggle + AdvancedFiltersPanel (payment status) + monthly breakdown + payments list
 * @author Claude Code (Anthropic AI) + Γιώργος Παγώνης
 * @created 2026-02-09
 * @updated 2026-02-10 — Collapsible dashboard via AccountingPageHeader + payment status filter
 * @see ADR-ACC-006 EFKA Contributions
 * @compliance CLAUDE.md Enterprise Standards — zero `any`, no inline styles, semantic HTML
 */

import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Spinner } from '@/components/ui/spinner';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  PiggyBank,
  DollarSign,
  Clock,
  AlertTriangle,
  CheckCircle,
} from 'lucide-react';
import { UnifiedDashboard } from '@/components/property-management/dashboard/UnifiedDashboard';
import type { DashboardStat } from '@/components/property-management/dashboard/UnifiedDashboard';
import { AdvancedFiltersPanel } from '@/components/core/AdvancedFilters/AdvancedFiltersPanel';
import type { FilterPanelConfig, GenericFilterState } from '@/components/core/AdvancedFilters/types';
import { formatCurrency } from '../../utils/format';
import { AccountingPageHeader } from '../shared/AccountingPageHeader';
import { useEFKASummary } from '../../hooks/useEFKASummary';
import { FiscalYearPicker } from '../shared/FiscalYearPicker';
import { EFKAMonthlyBreakdown } from './EFKAMonthlyBreakdown';
import { EFKAPaymentsList } from './EFKAPaymentsList';
import { PartnerEFKATabs } from './PartnerEFKATabs';

// ============================================================================
// TYPES
// ============================================================================

interface EFKAFilterState extends GenericFilterState {
  paymentStatus: string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const DEFAULT_FILTERS: EFKAFilterState = {
  paymentStatus: 'all',
};

// ============================================================================
// HELPERS
// ============================================================================

function buildFilterConfig(t: (key: string) => string): FilterPanelConfig {
  return {
    title: 'filters.title',
    i18nNamespace: 'accounting',
    rows: [
      {
        id: 'efka-main',
        fields: [
          {
            id: 'paymentStatus',
            type: 'select',
            label: 'filterLabels.paymentStatus',
            ariaLabel: 'Payment status',
            width: 1,
            options: [
              { value: 'all', label: t('filterOptions.allPaymentStatuses') },
              { value: 'paid', label: t('efka.paymentStatuses.paid') },
              { value: 'pending', label: t('efka.paymentStatuses.pending') },
              { value: 'overdue', label: t('efka.paymentStatuses.overdue') },
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

export function EFKAPageContent() {
  const { t } = useTranslation('accounting');

  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [showDashboard, setShowDashboard] = useState(true);
  const [filters, setFilters] = useState<EFKAFilterState>({ ...DEFAULT_FILTERS });

  const filterConfig = useMemo(() => buildFilterConfig(t), [t]);

  const { summary, partnershipSummary, entityType, loading, error, refetch } = useEFKASummary({ year: selectedYear });

  // Filter payments by payment status (client-side)
  const filteredPayments = useMemo(() => {
    if (!summary) return [];
    if (filters.paymentStatus === 'all') return summary.payments;
    return summary.payments.filter((p) => p.status === filters.paymentStatus);
  }, [summary, filters.paymentStatus]);

  // Filter monthly breakdown to show only months matching filtered payments
  const filteredBreakdown = useMemo(() => {
    if (!summary) return [];
    if (filters.paymentStatus === 'all') return summary.monthlyBreakdown;
    const matchingMonths = new Set(filteredPayments.map((p) => p.month));
    return summary.monthlyBreakdown.filter((m) => matchingMonths.has(m.month));
  }, [summary, filters.paymentStatus, filteredPayments]);

  // Compute dashboard stats — entity-aware
  const dashboardStats: DashboardStat[] = useMemo(() => {
    // Partnership (OE) dashboard stats
    if (entityType === 'oe' && partnershipSummary) {
      const totalPaid = partnershipSummary.totalAllPartnersPaid;
      const totalDue = partnershipSummary.totalAllPartnersDue;
      const balance = totalDue - totalPaid;

      return [
        {
          title: t('dashboard.totalPaid'),
          value: formatCurrency(totalPaid),
          icon: CheckCircle,
          color: 'green' as const,
          description: t('efka.partnerTabs.totalAllPartners'),
          loading,
        },
        {
          title: t('dashboard.totalDue'),
          value: formatCurrency(totalDue),
          icon: DollarSign,
          color: 'blue' as const,
          loading,
        },
        {
          title: t('dashboard.balanceDue'),
          value: formatCurrency(balance),
          icon: balance > 0 ? AlertTriangle : CheckCircle,
          color: balance > 0 ? 'red' as const : 'green' as const,
          loading,
        },
      ];
    }

    // Sole proprietor dashboard stats
    if (!summary) {
      return [
        { title: t('dashboard.totalPaid'), value: '—', icon: CheckCircle, color: 'green' as const, loading },
        { title: t('dashboard.totalDue'), value: '—', icon: DollarSign, color: 'blue' as const, loading },
        { title: t('dashboard.balanceDue'), value: '—', icon: Clock, color: 'gray' as const, loading },
      ];
    }

    return [
      {
        title: t('dashboard.totalPaid'),
        value: formatCurrency(summary.totalPaid),
        icon: CheckCircle,
        color: 'green' as const,
        description: `${summary.paidMonths} ${t('efka.month')}`,
        loading,
      },
      {
        title: t('dashboard.totalDue'),
        value: formatCurrency(summary.totalDue),
        icon: DollarSign,
        color: 'blue' as const,
        loading,
      },
      {
        title: t('dashboard.balanceDue'),
        value: formatCurrency(summary.balanceDue),
        icon: summary.balanceDue > 0 ? AlertTriangle : CheckCircle,
        color: summary.balanceDue > 0 ? 'red' as const : 'green' as const,
        loading,
      },
    ];
  }, [summary, partnershipSummary, entityType, loading, t]);

  return (
    <main className="min-h-screen bg-background">
      {/* Header */}
      <AccountingPageHeader
        icon={PiggyBank}
        titleKey="efka.title"
        descriptionKey="efka.description"
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

      {/* Payment Status Filter */}
      <AdvancedFiltersPanel
        config={filterConfig}
        filters={filters}
        onFiltersChange={setFilters}
        defaultFilters={DEFAULT_FILTERS}
      />

      {/* Content */}
      <section className="p-6 space-y-6">
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
        ) : entityType === 'oe' && partnershipSummary ? (
          <PartnerEFKATabs summary={partnershipSummary} />
        ) : !summary ? (
          <div className="text-center py-12">
            <p className="text-lg font-medium text-foreground mb-1">
              {t('efka.noData')}
            </p>
            <p className="text-muted-foreground">
              {t('efka.noDataDescription')}
            </p>
          </div>
        ) : (
          <>
            {/* Monthly Breakdown */}
            <section aria-label={t('efka.monthlyBreakdownTitle')}>
              <h2 className="text-lg font-semibold text-foreground mb-4">
                {t('efka.monthlyBreakdownTitle')}
              </h2>
              <EFKAMonthlyBreakdown breakdown={filteredBreakdown} />
            </section>

            <Separator />

            {/* Payments */}
            <section aria-label={t('efka.paymentsTitle')}>
              <h2 className="text-lg font-semibold text-foreground mb-4">
                {t('efka.paymentsTitle')}
              </h2>
              <EFKAPaymentsList payments={filteredPayments} />
            </section>
          </>
        )}
      </section>
    </main>
  );
}
