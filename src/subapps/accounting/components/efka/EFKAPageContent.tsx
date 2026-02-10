'use client';

/**
 * @fileoverview EFKA Page Content — Εισφορές ΕΦΚΑ
 * @description UnifiedDashboard stats + monthly breakdown + payments list
 * @author Claude Code (Anthropic AI) + Γιώργος Παγώνης
 * @created 2026-02-09
 * @updated 2026-02-10 — Migrated annual summary cards to UnifiedDashboard
 * @see ADR-ACC-006 EFKA Contributions
 * @compliance CLAUDE.md Enterprise Standards — zero `any`, no inline styles, semantic HTML
 */

import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Spinner } from '@/components/ui/spinner';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  DollarSign,
  Clock,
  AlertTriangle,
  CheckCircle,
} from 'lucide-react';
import { UnifiedDashboard } from '@/components/property-management/dashboard/UnifiedDashboard';
import type { DashboardStat } from '@/components/property-management/dashboard/UnifiedDashboard';
import { useEFKASummary } from '../../hooks/useEFKASummary';
import { FiscalYearPicker } from '../shared/FiscalYearPicker';
import { EFKAMonthlyBreakdown } from './EFKAMonthlyBreakdown';
import { EFKAPaymentsList } from './EFKAPaymentsList';

// ============================================================================
// HELPERS
// ============================================================================

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('el-GR', { style: 'currency', currency: 'EUR' }).format(amount);
}

// ============================================================================
// COMPONENT
// ============================================================================

export function EFKAPageContent() {
  const { t } = useTranslation('accounting');

  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  const { summary, loading, error, refetch } = useEFKASummary({ year: selectedYear });

  // Compute dashboard stats from summary
  const dashboardStats: DashboardStat[] = useMemo(() => {
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
  }, [summary, loading, t]);

  return (
    <main className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">{t('efka.title')}</h1>
            <p className="text-sm text-muted-foreground mt-1">{t('efka.description')}</p>
          </div>
          <div className="w-32">
            <FiscalYearPicker value={selectedYear} onValueChange={setSelectedYear} />
          </div>
        </div>
      </header>

      {/* Stats Dashboard */}
      <UnifiedDashboard stats={dashboardStats} columns={4} />

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
              <EFKAMonthlyBreakdown breakdown={summary.monthlyBreakdown} />
            </section>

            <Separator />

            {/* Payments */}
            <section aria-label={t('efka.paymentsTitle')}>
              <h2 className="text-lg font-semibold text-foreground mb-4">
                {t('efka.paymentsTitle')}
              </h2>
              <EFKAPaymentsList payments={summary.payments} />
            </section>
          </>
        )}
      </section>
    </main>
  );
}
