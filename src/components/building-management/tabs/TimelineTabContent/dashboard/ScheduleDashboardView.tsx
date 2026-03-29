'use client';

/**
 * @module ScheduleDashboardView
 * @enterprise ADR-266 Phase A — Main container for schedule analytics dashboard
 *
 * Orchestrates KPIs, S-Curve, Variance Table, Lookahead, and Gantt link.
 * Data comes from useScheduleDashboard hook (client-side computation).
 */

import { useCallback, useState } from 'react';
import { RefreshCw, Download, FileDown, FileSpreadsheet, UserCheck, Table2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import { useSemanticColors } from '@/hooks/useSemanticColors';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { formatDateShort } from '@/lib/intl-utils';
import { cn } from '@/lib/utils';
import '@/lib/design-system';
import type { BuildingMilestone } from '@/types/building/milestone';
import type { TimelineView } from '../TimelineViewToggle';

import { useScheduleDashboard } from './useScheduleDashboard';
import { useBaselineComparison } from './useBaselineComparison';
import { ScheduleOverviewKPIs } from './ScheduleOverviewKPIs';
import { SCurveChart } from './SCurveChart';
import { ScheduleVarianceTable } from './ScheduleVarianceTable';
import { LookaheadTable } from './LookaheadTable';
import { GanttSnapshotCard } from './GanttSnapshotCard';
import { DelayBreakdownChart } from './DelayBreakdownChart';
import { CriticalPathSection } from './CriticalPathSection';
import { BaselineSection } from './BaselineSection';
import { ResourceHistogramChart } from './ResourceHistogramChart';
import { ResourceUtilizationKPIs } from './ResourceUtilizationKPIs';
import { useResourceHistogram } from './useResourceHistogram';
import { useResourceAssignments } from '@/hooks/useResourceAssignments';
import { ReportEmptyState } from '@/components/reports/core/ReportEmptyState';

// ─── Props ───────────────────────────────────────────────────────────────

interface ScheduleDashboardViewProps {
  buildingId: string;
  buildingName: string;
  milestones: BuildingMilestone[];
  onViewChange: (view: TimelineView) => void;
}

// ─── Component ───────────────────────────────────────────────────────────

export function ScheduleDashboardView({
  buildingId,
  buildingName,
  milestones,
  onViewChange,
}: ScheduleDashboardViewProps) {
  const { t } = useTranslation('building');
  const colors = useSemanticColors();
  const iconSizes = useIconSizes();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const {
    kpis,
    sCurveData,
    varianceRows,
    lookaheadRows,
    delayBreakdownData,
    phases,
    tasks,
    loading,
    boqLoading,
    lastUpdated,
    lookAheadDays,
    setLookAheadDays,
    refresh,
  } = useScheduleDashboard({ buildingId, milestones });

  const baselineComparison = useBaselineComparison(buildingId);

  // Resource assignments + histogram (ADR-266 C4)
  const { assignments: resourceAssignments } = useResourceAssignments({ buildingId });
  const resourceHistogram = useResourceHistogram({ assignments: resourceAssignments, tasks });

  // ── Refresh handler ────────────────────────────────────────────────────
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await refresh();
    } finally {
      setIsRefreshing(false);
    }
  }, [refresh]);

  // ── Export handler ─────────────────────────────────────────────────────
  type ExportFormat = 'pdf' | 'excel' | 'owner-pdf' | 'gantt-table';

  const handleExport = useCallback(async (format: ExportFormat) => {
    setIsExporting(true);
    const dateStr = new Date().toISOString().slice(0, 10);
    try {
      if (format === 'pdf') {
        const { exportReportToPdf } = await import('@/services/report-engine/report-pdf-exporter');
        await exportReportToPdf({
          title: `${t('tabs.timeline.dashboard.title')} — ${buildingName}`,
          orientation: 'landscape',
          filename: `Schedule_Dashboard_${buildingName}_${dateStr}.pdf`,
          kpiCards: [
            { label: t('tabs.timeline.dashboard.kpis.overallProgress'), value: `${kpis.overallProgress}%`, color: [59, 130, 246] },
            { label: t('tabs.timeline.dashboard.kpis.spi'), value: kpis.spi.toFixed(2), color: [34, 197, 94] },
            { label: t('tabs.timeline.dashboard.kpis.cpi'), value: kpis.cpi.toFixed(2), color: [168, 85, 247] },
            { label: t('tabs.timeline.dashboard.kpis.daysRemaining'), value: String(kpis.daysRemaining), color: [249, 115, 22] },
            { label: t('tabs.timeline.dashboard.kpis.phasesOnTrack'), value: `${kpis.phasesOnTrack}/${kpis.totalPhases}`, color: [34, 197, 94] },
            { label: t('tabs.timeline.dashboard.kpis.delayedTasks'), value: String(kpis.delayedTasks), color: [239, 68, 68] },
          ],
          tables: [{
            title: t('tabs.timeline.dashboard.variance.title'),
            headers: [
              t('tabs.timeline.dashboard.variance.colName'),
              t('tabs.timeline.dashboard.variance.colPlannedEnd'),
              t('tabs.timeline.dashboard.variance.colActualEnd'),
              t('tabs.timeline.dashboard.variance.colVariance'),
              t('tabs.timeline.dashboard.variance.colProgress'),
            ],
            rows: varianceRows
              .filter(r => r.type === 'phase')
              .map(r => [
                `${r.code} ${r.name}`,
                formatDateShort(r.plannedEnd),
                r.actualEnd ? formatDateShort(r.actualEnd) : '—',
                `${r.varianceDays > 0 ? '+' : ''}${r.varianceDays}d`,
                `${r.progress}%`,
              ]),
          }],
        });
      } else if (format === 'excel') {
        const { exportReportToExcel } = await import('@/services/report-engine/report-excel-exporter');
        await exportReportToExcel({
          title: `${t('tabs.timeline.dashboard.title')} — ${buildingName}`,
          filename: `Schedule_Dashboard_${buildingName}_${dateStr}.xlsx`,
          summaryRows: [
            { metric: t('tabs.timeline.dashboard.kpis.overallProgress'), value: kpis.overallProgress, format: 'percentage' },
            { metric: t('tabs.timeline.dashboard.kpis.spi'), value: kpis.spi, format: 'number' },
            { metric: t('tabs.timeline.dashboard.kpis.cpi'), value: kpis.cpi, format: 'number' },
            { metric: t('tabs.timeline.dashboard.kpis.daysRemaining'), value: kpis.daysRemaining, format: 'number' },
            { metric: t('tabs.timeline.dashboard.kpis.phasesOnTrack'), value: `${kpis.phasesOnTrack}/${kpis.totalPhases}` },
            { metric: t('tabs.timeline.dashboard.kpis.delayedTasks'), value: kpis.delayedTasks, format: 'number' },
          ],
          detailColumns: [
            { header: t('tabs.timeline.dashboard.variance.colName'), key: 'name', width: 30 },
            { header: t('tabs.timeline.dashboard.variance.colPlannedEnd'), key: 'plannedEnd', width: 15, format: 'date' },
            { header: t('tabs.timeline.dashboard.variance.colActualEnd'), key: 'actualEnd', width: 15, format: 'date' },
            { header: t('tabs.timeline.dashboard.variance.colVariance'), key: 'variance', width: 12, format: 'number' },
            { header: t('tabs.timeline.dashboard.variance.colProgress'), key: 'progress', width: 12, format: 'percentage' },
          ],
          detailRows: varianceRows
            .filter(r => r.type === 'phase')
            .map(r => ({
              name: `${r.code} ${r.name}`,
              plannedEnd: r.plannedEnd,
              actualEnd: r.actualEnd ?? '—',
              variance: r.varianceDays,
              progress: r.progress / 100,
            })),
        });
      } else if (format === 'owner-pdf') {
        const { exportOwnerReportToPdf } = await import('@/services/report-engine/owner-report-pdf-exporter');
        const ends = phases.map(p => new Date(p.plannedEndDate).getTime());
        const latestEnd = ends.length > 0 ? new Date(Math.max(...ends)).toISOString() : new Date().toISOString();
        const daysRem = ends.length > 0 ? Math.max(0, Math.ceil((Math.max(...ends) - Date.now()) / 86_400_000)) : 0;

        await exportOwnerReportToPdf({
          buildingName,
          reportDate: new Date(),
          overallProgress: kpis.overallProgress,
          expectedProgress: kpis.expectedProgress,
          expectedCompletionDate: latestEnd,
          daysRemaining: daysRem,
          phases: phases.map(p => ({
            name: p.name,
            code: p.code,
            progress: p.progress,
            status: p.status,
            plannedEnd: p.plannedEndDate,
          })),
          milestones: milestones.map(m => ({
            title: m.title,
            date: m.date,
            status: m.status,
            progress: m.progress,
          })),
          filename: `Owner_Report_${buildingName}_${dateStr}.pdf`,
          statusLabels: {
            planning: t('tabs.timeline.dashboard.ownerReport.statusOnTrack'),
            notStarted: t('tabs.timeline.dashboard.ownerReport.statusOnTrack'),
            inProgress: t('tabs.timeline.dashboard.ownerReport.statusOnTrack'),
            completed: t('tabs.timeline.dashboard.ownerReport.statusCompleted'),
            delayed: t('tabs.timeline.dashboard.ownerReport.statusDelayed'),
            blocked: t('tabs.timeline.dashboard.ownerReport.statusBlocked'),
          },
          labels: {
            title: t('tabs.timeline.dashboard.ownerReport.title'),
            overallProgress: t('tabs.timeline.dashboard.ownerReport.overallProgress'),
            expectedCompletion: t('tabs.timeline.dashboard.ownerReport.expectedCompletion'),
            daysRemaining: t('tabs.timeline.dashboard.ownerReport.daysRemaining'),
            milestonesTitle: t('tabs.timeline.dashboard.ownerReport.milestonesTitle'),
            phasesTitle: t('tabs.timeline.dashboard.ownerReport.phasesTitle'),
            colTitle: t('tabs.timeline.dashboard.ownerReport.colTitle'),
            colDate: t('tabs.timeline.dashboard.ownerReport.colDate'),
            colStatus: t('tabs.timeline.dashboard.ownerReport.colStatus'),
            colProgress: t('tabs.timeline.dashboard.ownerReport.colProgress'),
            colPhase: t('tabs.timeline.dashboard.ownerReport.colPhase'),
            colPlannedEnd: t('tabs.timeline.dashboard.ownerReport.colPlannedEnd'),
            colCode: t('tabs.timeline.dashboard.ownerReport.colCode'),
          },
        });
      } else if (format === 'gantt-table') {
        const { exportGanttTableToPdf } = await import('@/services/gantt-export/gantt-table-pdf-exporter');
        await exportGanttTableToPdf({
          buildingName,
          phases,
          tasks,
          filename: `Gantt_Table_${buildingName}_${dateStr}.pdf`,
          statusLabels: {
            planning: t('tabs.timeline.dashboard.ownerReport.statusOnTrack'),
            notStarted: t('tabs.timeline.dashboard.ownerReport.statusOnTrack'),
            inProgress: t('tabs.timeline.dashboard.ownerReport.statusOnTrack'),
            completed: t('tabs.timeline.dashboard.ownerReport.statusCompleted'),
            delayed: t('tabs.timeline.dashboard.ownerReport.statusDelayed'),
            blocked: t('tabs.timeline.dashboard.ownerReport.statusBlocked'),
          },
        });
      }
    } finally {
      setIsExporting(false);
    }
  }, [kpis, varianceRows, phases, tasks, milestones, buildingName, t]);

  // ── Global empty state ─────────────────────────────────────────────────
  if (!loading && kpis.totalPhases === 0) {
    return (
      <section className="space-y-4" aria-label={t('tabs.timeline.dashboard.title')}>
        <ReportEmptyState
          title={t('tabs.timeline.dashboard.empty.noPhases')}
          description={t('tabs.timeline.dashboard.empty.noPhasesDesc')}
          action={{
            label: t('tabs.timeline.dashboard.empty.goToGantt'),
            onClick: () => onViewChange('gantt'),
          }}
        />
      </section>
    );
  }

  return (
    <section className="space-y-4" aria-label={t('tabs.timeline.dashboard.title')}>
      {/* Header: Last updated + Refresh + Export */}
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold">{t('tabs.timeline.dashboard.title')}</h2>
          {lastUpdated && (
            <span className={cn('text-xs', colors.text.muted)}>
              {t('tabs.timeline.dashboard.lastUpdated')}: {formatDateShort(lastUpdated)}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRefresh}
            disabled={isRefreshing}
            aria-label={t('tabs.timeline.dashboard.refresh')}
          >
            <RefreshCw className={cn(iconSizes.sm, isRefreshing && 'animate-spin')} />
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" disabled={isExporting || loading}>
                <Download className={cn(iconSizes.sm, 'mr-1.5')} />
                {t('tabs.timeline.dashboard.export')}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => handleExport('pdf')}>
                <FileDown className={cn(iconSizes.sm, 'mr-2')} />
                {t('tabs.timeline.dashboard.exportPdf')}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExport('excel')}>
                <FileSpreadsheet className={cn(iconSizes.sm, 'mr-2')} />
                {t('tabs.timeline.dashboard.exportExcel')}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExport('owner-pdf')}>
                <UserCheck className={cn(iconSizes.sm, 'mr-2')} />
                {t('tabs.timeline.dashboard.exportOwnerPdf')}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExport('gantt-table')}>
                <Table2 className={cn(iconSizes.sm, 'mr-2')} />
                {t('tabs.timeline.dashboard.exportGanttTable')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {/* Loading skeleton */}
      {loading ? (
        <div className="space-y-4">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-[350px] w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      ) : (
        <>
          <ScheduleOverviewKPIs kpis={kpis} loading={boqLoading} />
          <SCurveChart data={sCurveData} loading={boqLoading} enableBrush />
          <DelayBreakdownChart data={delayBreakdownData} loading={boqLoading} />
          <CriticalPathSection tasks={tasks} phases={phases} loading={boqLoading} />
          {resourceHistogram.hasData && (
            <>
              <ResourceUtilizationKPIs utilization={resourceHistogram.utilization} loading={boqLoading} />
              <ResourceHistogramChart
                data={resourceHistogram.histogramData}
                chartConfig={resourceHistogram.chartConfig}
                resourceNames={resourceHistogram.resourceNames}
                loading={boqLoading}
              />
            </>
          )}
          <BaselineSection baseline={baselineComparison} loading={loading} />
          <ScheduleVarianceTable
            rows={varianceRows}
            baselineData={baselineComparison.selectedBaseline}
            onClearBaseline={baselineComparison.clearComparison}
          />
          <LookaheadTable
            rows={lookaheadRows}
            lookAheadDays={lookAheadDays}
            onLookAheadChange={setLookAheadDays}
          />
          <GanttSnapshotCard onViewChange={onViewChange} />
        </>
      )}
    </section>
  );
}
