'use client';

/**
 * @fileoverview Financial Reports Dashboard (Phase 2e)
 * @description 8-card grid with date filter — drill-down to detail view
 * @author Claude Code (Anthropic AI) + Γιώργος Παγώνης
 * @created 2026-03-30
 * @see DECISIONS-PHASE-2.md §2e (Q12 — dashboard tiles + drill-down)
 * @compliance CLAUDE.md Enterprise Standards — zero `any`, semantic HTML
 */

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { AlertCircle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import type { ReportType, ReportDateFilter } from '@/subapps/accounting/types';
import { useReportsDashboard } from '../../hooks/useReportsDashboard';
import { ReportDateFilterBar } from './ReportDateFilterBar';
import { FinancialReportCard } from './FinancialReportCard';

// ============================================================================
// CONSTANTS
// ============================================================================

const ALL_REPORT_TYPES: readonly ReportType[] = [
  'profit_and_loss',
  'trial_balance',
  'ar_aging',
  'tax_summary',
  'bank_reconciliation',
  'cash_flow',
  'income_by_customer',
  'expense_by_category',
] as const;

const SKELETON_COUNT = 8;

// ============================================================================
// COMPONENT
// ============================================================================

export function FinancialReportsDashboard() {
  const router = useRouter();
  const { t } = useTranslation(['accounting', 'accounting-setup', 'accounting-tax-offices']);
  const [dateFilter, setDateFilter] = useState<ReportDateFilter>({ preset: 'this_month' });
  const { summaries, loading, errors } = useReportsDashboard(dateFilter);

  const handleCardClick = useCallback(
    (type: ReportType) => {
      const params = new URLSearchParams();
      params.set('preset', dateFilter.preset);
      if (dateFilter.customFrom) params.set('from', dateFilter.customFrom);
      if (dateFilter.customTo) params.set('to', dateFilter.customTo);
      router.push(`/accounting/reports/${type}?${params.toString()}`);
    },
    [router, dateFilter]
  );

  return (
    <section className="p-6 space-y-6" aria-label={t('reports.tabs.financialReports')}>
      {/* Date Filter Bar */}
      <ReportDateFilterBar
        value={dateFilter}
        onValueChange={setDateFilter}
        disabled={loading}
      />

      {/* Cards Grid */}
      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {loading ? (
          Array.from({ length: SKELETON_COUNT }).map((_, i) => (
            <Card key={i}>
              <CardContent className="pt-6">
                <Skeleton className="h-4 w-32 mb-3" />
                <Skeleton className="h-8 w-24 mb-2" />
                <Skeleton className="h-5 w-16" />
              </CardContent>
            </Card>
          ))
        ) : (
          ALL_REPORT_TYPES.map((type) => {
            const summary = summaries.find((s) => s.type === type);
            const error = errors.find((e) => e.type === type);

            if (error) {
              return (
                <Card key={type} className="opacity-60">
                  <CardContent className="pt-6 text-center">
                    <AlertCircle className="h-5 w-5 text-destructive mx-auto mb-2" />
                    <p className="text-xs text-muted-foreground">
                      {t(`reports.reportTypes.${type}`)}
                    </p>
                    <p className="text-xs text-destructive mt-1">{error.error}</p>
                  </CardContent>
                </Card>
              );
            }

            if (!summary) return null;

            return (
              <FinancialReportCard
                key={type}
                type={type}
                keyMetric={summary.keyMetric}
                change={summary.change}
                format={summary.format}
                onClick={() => handleCardClick(type)}
              />
            );
          })
        )}
      </section>
    </section>
  );
}
