'use client';

/**
 * @module ReportPage
 * @enterprise ADR-265 — Standard report page layout
 *
 * Composes all core primitives into a consistent page structure:
 * Header (title + date range + export) → KPI grid → content sections.
 *
 * Progressive loading (Decision 12.16): Each section loads independently.
 * Responsive (Decision 12.26): Works on desktop, tablet, and mobile.
 */

import '@/lib/design-system';
import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useSemanticColors } from '@/hooks/useSemanticColors';
import { useTypography } from '@/hooks/useTypography';
import { RefreshCw, type LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { ReportDateRange, type DateRangeValue, type PeriodPreset, type ComparisonMode } from './ReportDateRange';
import { ReportExportBar, type ExportFormat } from './ReportExportBar';
import { ReportKPIGrid, type ReportKPI } from './ReportKPIGrid';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function computeInitialRange(preset: PeriodPreset): DateRangeValue {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const qStart = Math.floor(month / 3) * 3;

  switch (preset) {
    case 'quarter':
      return {
        from: new Date(year, qStart, 1),
        to: new Date(year, qStart + 3, 0, 23, 59, 59, 999),
        preset: 'quarter',
      };
    case 'month':
      return {
        from: new Date(year, month, 1),
        to: new Date(year, month + 1, 0, 23, 59, 59, 999),
        preset: 'month',
      };
    case 'year':
      return {
        from: new Date(year, 0, 1),
        to: new Date(year, 11, 31, 23, 59, 59, 999),
        preset: 'year',
      };
    default:
      return {
        from: new Date(year, qStart, 1),
        to: new Date(year, qStart + 3, 0, 23, 59, 59, 999),
        preset: 'quarter',
      };
  }
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ReportPageProps {
  /** Page title (i18n-translated) */
  title: string;
  /** Page description */
  description?: string;
  /** Page icon */
  icon?: LucideIcon;
  /** Report sections (children) */
  children: React.ReactNode;
  /** Show date range picker (default: true) */
  showDateRange?: boolean;
  /** Show export bar (default: true) */
  showExportBar?: boolean;
  /** Show KPI grid (default: false — pass kpis to show) */
  showKPIs?: boolean;
  /** KPI definitions */
  kpis?: ReportKPI[];
  /** Default period preset (default: 'quarter') */
  defaultPreset?: PeriodPreset;
  /** Controlled date range */
  dateRange?: DateRangeValue;
  /** Date range change handler */
  onDateRangeChange?: (value: DateRangeValue) => void;
  /** Export handler */
  onExport?: (format: ExportFormat) => void;
  /** Refresh handler */
  onRefresh?: () => void;
  /** Export disabled (default: true in Phase 1) */
  exportDisabled?: boolean;
  /** KPI click handler */
  onKPIClick?: (kpi: ReportKPI, index: number) => void;
  className?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ReportPage({
  title,
  description,
  icon: Icon,
  children,
  showDateRange = true,
  showExportBar = true,
  showKPIs = false,
  kpis,
  defaultPreset = 'quarter',
  dateRange: controlledDateRange,
  onDateRangeChange,
  onExport,
  onRefresh,
  exportDisabled = true,
  onKPIClick,
  className,
}: ReportPageProps) {
  const colors = useSemanticColors();
  const typography = useTypography();

  const { t } = useTranslation('common');

  // Internal date range state (uncontrolled mode)
  const [internalDateRange, setInternalDateRange] = useState<DateRangeValue>(
    () => computeInitialRange(defaultPreset),
  );
  const [comparisonMode, setComparisonMode] = useState<ComparisonMode>('yoy');

  const dateRange = controlledDateRange ?? internalDateRange;
  const handleDateRangeChange = onDateRangeChange ?? setInternalDateRange;

  const handleRefresh = useCallback(() => {
    onRefresh?.();
  }, [onRefresh]);

  return (
    <main className={cn('flex flex-col gap-6 p-4 sm:p-6', className)}>
      {/* Header */}
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-center gap-3">
          {Icon && (
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Icon className="h-5 w-5 text-primary" />
            </span>
          )}
          <div>
            <h1 className={cn(typography.heading.h2, colors.text.primary)}>{title}</h1>
            {description && (
              <p className={cn('mt-0.5', typography.body, colors.text.muted)}>
                {description}
              </p>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap items-center gap-3">
          {onRefresh && (
            <Button variant="outline" size="sm" onClick={handleRefresh} className="gap-1.5">
              <RefreshCw className="h-4 w-4" />
              <span className="hidden sm:inline">{t('buttons.refresh')}</span>
            </Button>
          )}
          {showExportBar && (
            <ReportExportBar
              onExport={onExport}
              disabled={exportDisabled}
            />
          )}
        </div>
      </header>

      {/* Date Range */}
      {showDateRange && (
        <ReportDateRange
          value={dateRange}
          onChange={handleDateRangeChange}
          comparisonMode={comparisonMode}
          onComparisonModeChange={setComparisonMode}
        />
      )}

      {/* KPI Grid */}
      {showKPIs && kpis && kpis.length > 0 && (
        <ReportKPIGrid kpis={kpis} onKPIClick={onKPIClick} />
      )}

      {/* Report Sections */}
      <div className="flex flex-col gap-6">
        {children}
      </div>
    </main>
  );
}
