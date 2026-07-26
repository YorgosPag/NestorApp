/**
 * @module components/reports/builder/ChartSection
 * @enterprise ADR-268 Phase 2 — Chart visualization with type selector
 *
 * Transforms GroupingResult into ReportChart data format.
 * Chart type auto-suggested based on field type, with manual override.
 * REUSES: ReportChart (ADR-265), onElementClick for cross-filter.
 */

'use client';

import '@/lib/design-system';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { BarChart3, LineChart as LineIcon, PieChart as PieIcon, AreaChart as AreaIcon, Layers } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ReportChart, type ChartType } from '@/components/reports/core/ReportChart';
import type { ChartSeries } from '@/components/ui/chart-card';
import { formatNumber } from '@/lib/intl-utils';
import { aggregateKey, UNKNOWN_GROUP_KEY } from '@/services/report-engine/grouping-engine';
import type {
  GroupByConfig,
  BuilderChartType,
  ChartCrossFilter,
  GroupedRow,
} from '@/config/report-builder/report-builder-types';

// ============================================================================
// Types
// ============================================================================

interface ChartSectionProps {
  groupByConfig: GroupByConfig;
  filteredGroups: GroupedRow[];
  /**
   * Every group of the current grouping, before any cross-filter narrows it.
   *
   * The slice colours are read from this order, not from the rows on screen: clicking a
   * slice to cross-filter must not repaint the groups that survive (ADR-710 §11.6). It is
   * the same rule the named reports follow, with the grouping standing in for a fixed
   * domain vocabulary.
   */
  allGroups: GroupedRow[];
  activeChartType: BuilderChartType;
  suggestedChartType: BuilderChartType | null;
  onChartTypeChange: (type: BuilderChartType | null) => void;
  onCrossFilter: (filter: ChartCrossFilter) => void;
  /** Ref to chart container for html-to-image capture (Phase 3 export) */
  chartContainerRef?: React.Ref<HTMLDivElement>;
  className?: string;
}

// ============================================================================
// Chart Type Icons
// ============================================================================

const CHART_TYPE_OPTIONS: Array<{
  type: BuilderChartType;
  icon: React.ElementType;
  labelKey: string;
}> = [
  { type: 'bar', icon: BarChart3, labelKey: 'chart.bar' },
  { type: 'line', icon: LineIcon, labelKey: 'chart.line' },
  { type: 'pie', icon: PieIcon, labelKey: 'chart.pie' },
  { type: 'area', icon: AreaIcon, labelKey: 'chart.area' },
  { type: 'stacked-bar', icon: Layers, labelKey: 'chart.stackedBar' },
];

// ============================================================================
// Data Transformation
// ============================================================================

interface BuilderPoint {
  name: string;
  value: number;
  count: number;
}

function buildChartData(
  groups: GroupedRow[],
  unknownLabel: string,
): { data: BuilderPoint[]; primaryMetric: string } {
  const firstGroup = groups[0];
  if (!firstGroup) {
    return { data: [], primaryMetric: '' };
  }

  // Pick the first non-COUNT aggregate, fallback to COUNT
  const aggKeys = Object.keys(firstGroup.aggregates);
  const primaryMetric = aggKeys.find(k => !k.startsWith('COUNT:')) ?? aggregateKey('COUNT', '*');

  const data = groups.map(group => ({
    name: group.groupKey === UNKNOWN_GROUP_KEY ? unknownLabel : group.groupKey,
    value: group.aggregates[primaryMetric] ?? group.rowCount,
    count: group.rowCount,
  }));

  return { data, primaryMetric };
}

/** The group names, in grouping order — the builder equivalent of a declared vocabulary. */
function buildCategoryOrder(groups: GroupedRow[], unknownLabel: string): string[] {
  return groups.map(group =>
    group.groupKey === UNKNOWN_GROUP_KEY ? unknownLabel : group.groupKey,
  );
}

// ============================================================================
// Component
// ============================================================================

export function ChartSection({
  groupByConfig,
  filteredGroups,
  allGroups,
  activeChartType,
  suggestedChartType,
  onChartTypeChange,
  onCrossFilter,
  chartContainerRef,
  className,
}: ChartSectionProps) {
  const { t } = useTranslation('report-builder');

  const unknownLabel = t('grouping.noGrouping');
  const { data, primaryMetric } = useMemo(
    () => buildChartData(filteredGroups, unknownLabel),
    [filteredGroups, unknownLabel],
  );

  const categoryOrder = useMemo(
    () => buildCategoryOrder(allGroups, unknownLabel),
    [allGroups, unknownLabel],
  );

  const series = useMemo<ChartSeries<BuilderPoint>[]>(
    () => [{ key: 'value', label: primaryMetric.replace(':', ': ') || t('chart.value') }],
    [primaryMetric, t],
  );

  const handleElementClick = (point: BuilderPoint) => {
    if (!point.name) return;
    onCrossFilter({
      fieldKey: groupByConfig.level1,
      value: point.name === unknownLabel ? UNKNOWN_GROUP_KEY : point.name,
      label: point.name,
    });
  };

  if (data.length === 0) return null;

  // Map BuilderChartType to ChartType (they match except stacked-bar)
  const chartType: ChartType = activeChartType;

  return (
    <section
      className={cn('space-y-3', className)}
      aria-label={t('chart.title')}
    >
      {/* Chart type selector */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1" role="radiogroup" aria-label={t('chart.type')}>
          {CHART_TYPE_OPTIONS.map(({ type, icon: Icon, labelKey }) => (
            <Button
              key={type}
              variant={activeChartType === type ? 'default' : 'outline'}
              size="sm"
              className="h-8 gap-1.5"
              onClick={() => onChartTypeChange(type === suggestedChartType ? null : type)}
              role="radio"
              aria-checked={activeChartType === type}
              aria-label={t(labelKey)}
            >
              <Icon className="h-3.5 w-3.5" />
              <span className="hidden sm:inline text-xs">{t(labelKey)}</span>
              {type === suggestedChartType && activeChartType === type && (
                <Badge variant="secondary" className="h-4 px-1 text-[10px]">
                  {t('chart.suggested')}
                </Badge>
              )}
            </Button>
          ))}
        </div>

      </div>

      {/* Chart */}
      <div ref={chartContainerRef} className="motion-safe:transition-all motion-safe:duration-300">
        <ReportChart
          type={chartType}
          data={data}
          series={series}
          categoryKey="name"
          categoryLabel={t('chart.category')}
          categoryOrder={categoryOrder}
          formatValue={formatNumber}
          onElementClick={handleElementClick}
        />
      </div>
    </section>
  );
}
