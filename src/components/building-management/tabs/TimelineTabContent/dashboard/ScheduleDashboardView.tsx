'use client';

/**
 * @module ScheduleDashboardView
 * @enterprise ADR-266 Phase A — Main container for schedule analytics dashboard
 *
 * Orchestrates KPIs, S-Curve, Variance Table, Lookahead, and Gantt link.
 * Data comes from useScheduleDashboard hook (client-side computation).
 */

import { useCallback, useState } from 'react';
import { RefreshCw, Download, FileDown, FileSpreadsheet } from 'lucide-react';
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
import { ScheduleOverviewKPIs } from './ScheduleOverviewKPIs';
import { SCurveChart } from './SCurveChart';
import { ScheduleVarianceTable } from './ScheduleVarianceTable';
import { LookaheadTable } from './LookaheadTable';
import { GanttSnapshotCard } from './GanttSnapshotCard';
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
    loading,
    boqLoading,
    lastUpdated,
    lookAheadDays,
    setLookAheadDays,
    refresh,
  } = useScheduleDashboard({ buildingId, milestones });

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
  const handleExport = useCallback(async (format: 'pdf' | 'excel') => {
    setIsExporting(true);
    try {
      if (format === 'pdf') {
        const { exportReportToPdf } = await import('@/services/report-engine/report-pdf-exporter');
        await exportReportToPdf({
          title: `${t('tabs.timeline.dashboard.title')} — ${buildingName}`,
          orientation: 'landscape',
          filename: `Schedule_Dashboard_${buildingName}_${new Date().toISOString().slice(0, 10)}.pdf`,
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
      } else {
        const { exportReportToExcel } = await import('@/services/report-engine/report-excel-exporter');
        await exportReportToExcel({
          title: `${t('tabs.timeline.dashboard.title')} — ${buildingName}`,
          filename: `Schedule_Dashboard_${buildingName}_${new Date().toISOString().slice(0, 10)}.xlsx`,
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
      }
    } finally {
      setIsExporting(false);
    }
  }, [kpis, varianceRows, buildingName, t]);

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
          <SCurveChart data={sCurveData} loading={boqLoading} />
          <ScheduleVarianceTable rows={varianceRows} />
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
