'use client';

/**
 * ProjectProcurementOverview — Container for 5 Project Procurement KPIs
 *
 * Layout:
 *   Row 1: KpiOpenRfqs | KpiPendingApprovalPos | KpiTotalCommittedSpend | KpiBoqCoverage
 *   Row 2: ChartBudgetVsCommitted (full width)
 *
 * Each KPI is wrapped in ComponentErrorBoundary — a crash in one card
 * does not break the whole overview.
 *
 * @module components/projects/procurement/overview/ProjectProcurementOverview
 * @see ADR-330 §5.1 S3
 */

import { useTranslation } from '@/i18n/hooks/useTranslation';
import { AlertCircle } from 'lucide-react';
import { useProjectProcurementStats } from '@/hooks/useProjectProcurementStats';
import { ComponentErrorBoundary } from '@/components/ui/ErrorBoundary';
import { KpiOpenRfqs } from './kpi/KpiOpenRfqs';
import { KpiPendingApprovalPos } from './kpi/KpiPendingApprovalPos';
import { KpiTotalCommittedSpend } from './kpi/KpiTotalCommittedSpend';
import { KpiBoqCoverage } from './kpi/KpiBoqCoverage';
import { ChartBudgetVsCommitted } from './kpi/ChartBudgetVsCommitted';
import { KpiCardSkeleton, KpiChartSkeleton } from './skeleton/KpiSkeleton';

interface Props {
  projectId: string;
}

export function ProjectProcurementOverview({ projectId }: Props) {
  const { t } = useTranslation('procurement');
  const { stats, isLoading, error } = useProjectProcurementStats(projectId);

  if (error) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
        <AlertCircle className="h-4 w-4 shrink-0" aria-hidden />
        {t('overview.kpi.error')}
      </div>
    );
  }

  return (
    <section aria-label={t('overview.kpi.committedSpend.label')} className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <ComponentErrorBoundary>
          {isLoading ? <KpiCardSkeleton /> : <KpiOpenRfqs stats={stats} />}
        </ComponentErrorBoundary>

        <ComponentErrorBoundary>
          {isLoading ? <KpiCardSkeleton /> : <KpiPendingApprovalPos stats={stats} />}
        </ComponentErrorBoundary>

        <ComponentErrorBoundary>
          {isLoading ? <KpiCardSkeleton /> : <KpiTotalCommittedSpend stats={stats} />}
        </ComponentErrorBoundary>

        <ComponentErrorBoundary>
          {isLoading ? <KpiCardSkeleton /> : <KpiBoqCoverage stats={stats} />}
        </ComponentErrorBoundary>
      </div>

      <ComponentErrorBoundary>
        {isLoading ? <KpiChartSkeleton /> : <ChartBudgetVsCommitted stats={stats} />}
      </ComponentErrorBoundary>
    </section>
  );
}
