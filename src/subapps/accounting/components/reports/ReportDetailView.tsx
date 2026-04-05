'use client';

/**
 * @fileoverview Report Detail View (Phase 2e)
 * @description Full report page with comparative table, date filter, and export
 * @author Claude Code (Anthropic AI) + Γιώργος Παγώνης
 * @created 2026-03-30
 * @see DECISIONS-PHASE-2.md §2e (Q12 — drill-down)
 * @compliance CLAUDE.md Enterprise Standards — zero `any`, semantic HTML
 */

import { useState, useMemo } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { FileBarChart, ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { PageLoadingState } from '@/core/states';
import type { ReportType, ReportDateFilter, ReportDatePreset } from '@/subapps/accounting/types';
import { AccountingPageHeader } from '../shared/AccountingPageHeader';
import { ReportDateFilterBar } from './ReportDateFilterBar';
import { ReportTable } from './ReportTable';
import { ExportBar } from './ExportBar';
import { useReport } from '../../hooks/useReport';

// ============================================================================
// CONSTANTS
// ============================================================================

const VALID_TYPES: readonly ReportType[] = [
  'profit_and_loss',
  'trial_balance',
  'ar_aging',
  'tax_summary',
  'bank_reconciliation',
  'cash_flow',
  'income_by_customer',
  'expense_by_category',
] as const;

const VALID_PRESETS: readonly ReportDatePreset[] = [
  'this_month', 'last_month', 'this_quarter', 'last_quarter',
  'this_year', 'last_year', 'ytd', 'custom',
] as const;

// ============================================================================
// HELPERS
// ============================================================================

function isValidReportType(value: string): value is ReportType {
  return (VALID_TYPES as readonly string[]).includes(value);
}

function isValidPreset(value: string): value is ReportDatePreset {
  return (VALID_PRESETS as readonly string[]).includes(value);
}

// ============================================================================
// COMPONENT
// ============================================================================

export function ReportDetailView() {
  const { t } = useTranslation('accounting');
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();

  // Parse type from URL
  const typeParam = typeof params.type === 'string' ? params.type : '';
  const isValid = isValidReportType(typeParam);

  // Parse initial date filter from URL search params
  const initialPreset = searchParams.get('preset') ?? 'this_month';
  const initialFilter: ReportDateFilter = useMemo(() => ({
    preset: isValidPreset(initialPreset) ? initialPreset : 'this_month',
    customFrom: searchParams.get('from') ?? undefined,
    customTo: searchParams.get('to') ?? undefined,
  }), [initialPreset, searchParams]);

  const [dateFilter, setDateFilter] = useState<ReportDateFilter>(initialFilter);
  const [showDashboard, setShowDashboard] = useState(false);

  const { report, loading, error } = useReport({
    type: isValid ? typeParam : 'profit_and_loss',
    dateFilter,
    autoFetch: isValid,
  });

  if (!isValid) {
    return (
      <main className="min-h-screen bg-background p-6">
        <p className="text-destructive">
          Invalid report type: &quot;{typeParam}&quot;
        </p>
        <Button variant="outline" className="mt-4" onClick={() => router.push('/accounting/reports')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          {t('reports.detail.backToReports')}
        </Button>
      </main>
    );
  }

  const reportTitle = t(`reports.reportTypes.${typeParam}`);

  return (
    <main className="min-h-screen bg-background">
      <AccountingPageHeader
        icon={FileBarChart}
        titleKey={`reports.reportTypes.${typeParam}`}
        descriptionKey="reports.description"
        showDashboard={showDashboard}
        onDashboardToggle={() => setShowDashboard(!showDashboard)}
        actions={[
          <Button
            key="back"
            variant="ghost"
            size="sm"
            onClick={() => router.push('/accounting/reports')}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            {t('reports.detail.backToReports')}
          </Button>,
        ]}
      />

      <section className="p-6 space-y-4">
        {/* Filter + Export Row */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <ReportDateFilterBar
            value={dateFilter}
            onValueChange={setDateFilter}
            disabled={loading}
          />
          {report && (
            <ExportBar
              reportType={typeParam}
              data={report.data}
              period={report.period}
              reportTitle={reportTitle}
            />
          )}
        </div>

        {/* Loading */}
        {loading && (
          <PageLoadingState
            icon={FileBarChart}
            message={t('reports.loading')}
            layout="contained"
          />
        )}

        {/* Error */}
        {error && (
          <p className="text-destructive text-sm">{error}</p>
        )}

        {/* Report Table */}
        {report && !loading && (
          <ReportTable reportType={typeParam} data={report.data} />
        )}
      </section>
    </main>
  );
}
