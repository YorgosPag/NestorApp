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
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { BarChart3, LineChart as LineIcon, PieChart as PieIcon, AreaChart as AreaIcon, Layers } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ReportChart, type ChartType } from '@/components/reports/core/ReportChart';
import type { ChartConfig } from '@/components/ui/chart';
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
  activeChartType: BuilderChartType;
  suggestedChartType: BuilderChartType | null;
  onChartTypeChange: (type: BuilderChartType | null) => void;
  onCrossFilter: (filter: ChartCrossFilter) => void;
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

function buildChartData(
  groups: GroupedRow[],
  _config: GroupByConfig,
  unknownLabel: string,
): { data: Record<string, unknown>[]; config: ChartConfig; primaryMetric: string } {
  // Find the best metric to display
  const firstGroup = groups[0];
  if (!firstGroup) {
    return { data: [], config: {}, primaryMetric: '' };
  }

  // Pick the first non-COUNT aggregate, fallback to COUNT
  const aggKeys = Object.keys(firstGroup.aggregates);
  const primaryMetric = aggKeys.find(k => !k.startsWith('COUNT:')) ?? aggregateKey('COUNT', '*');

  const data = groups.map(group => ({
    name: group.groupKey === UNKNOWN_GROUP_KEY ? unknownLabel : group.groupKey,
    value: group.aggregates[primaryMetric] ?? group.rowCount,
    count: group.rowCount,
  }));

  const chartConfig: ChartConfig = {
    value: {
      label: primaryMetric.replace(':', ': '),
    },
  };

  return { data, config: chartConfig, primaryMetric };
}

// ============================================================================
// Component
// ============================================================================

export function ChartSection({
  groupByConfig,
  filteredGroups,
  activeChartType,
  suggestedChartType,
  onChartTypeChange,
  onCrossFilter,
  className,
}: ChartSectionProps) {
  const { t } = useTranslation('report-builder');
  const [showLegend, setShowLegend] = useState(true);

  const unknownLabel = t('grouping.noGrouping');
  const { data } = useMemo(
    () => buildChartData(filteredGroups, groupByConfig, unknownLabel),
    [filteredGroups, groupByConfig, unknownLabel],
  );

  const handleElementClick = (payload: Record<string, unknown>) => {
    const name = payload.name as string | undefined;
    if (!name) return;
    onCrossFilter({
      fieldKey: groupByConfig.level1,
      value: name === unknownLabel ? UNKNOWN_GROUP_KEY : name,
      label: name,
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
      {/* Chart type selector + legend toggle */}
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

        <div className="flex items-center gap-2">
          <Switch
            id="legend-toggle"
            checked={showLegend}
            onCheckedChange={setShowLegend}
          />
          <Label htmlFor="legend-toggle" className="text-xs cursor-pointer">
            {t('chart.legend')}
          </Label>
        </div>
      </div>

      {/* Chart */}
      <div className="motion-safe:transition-all motion-safe:duration-300">
        <ReportChart
          type={chartType}
          data={data}
          config={config}
          height={300}
          showLegend={showLegend}
          onElementClick={handleElementClick}
        />
      </div>
    </section>
  );
}
