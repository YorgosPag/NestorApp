'use client';

/**
 * @fileoverview Accounting Subapp — EFKA Page Content
 * @description Main page for EFKA social security contributions with annual summary
 * @author Claude Code (Anthropic AI) + Georgios Pagonis
 * @created 2026-02-09
 * @version 1.0.0
 * @see ADR-ACC-006 EFKA Contributions
 * @compliance CLAUDE.md Enterprise Standards — zero `any`, no inline styles, semantic HTML
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
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

  return (
    <main className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">{t('efka.title')}</h1>
            <p className="text-sm text-muted-foreground mt-1">{t('efka.description')}</p>
          </div>
          <div className="w-32">
            <FiscalYearPicker value={selectedYear} onValueChange={setSelectedYear} />
          </div>
        </div>
      </header>

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
            {/* Annual Summary Cards */}
            <section aria-label={t('efka.annualSummary')}>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Total Paid */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      {t('efka.totalPaid')}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                      {formatCurrency(summary.totalPaid)}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {t('paidMonths', { count: summary.paidMonths })}
                    </p>
                  </CardContent>
                </Card>

                {/* Total Due */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      {t('efka.totalDue')}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-bold text-foreground">
                      {formatCurrency(summary.totalDue)}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {t('efka.annualContributions')}
                    </p>
                  </CardContent>
                </Card>

                {/* Balance Due */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      {t('efka.balanceDue')}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p
                      className={`text-2xl font-bold ${
                        summary.balanceDue > 0
                          ? 'text-red-600 dark:text-red-400'
                          : 'text-emerald-600 dark:text-emerald-400'
                      }`}
                    >
                      {formatCurrency(summary.balanceDue)}
                    </p>
                    {summary.overdueMonths > 0 && (
                      <p className="text-xs text-destructive mt-1">
                        {t('overdueMonths', { count: summary.overdueMonths })}
                      </p>
                    )}
                  </CardContent>
                </Card>
              </div>
            </section>

            <Separator />

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
