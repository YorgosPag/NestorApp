'use client';

/**
 * SpendByProjectChart — Top 10 projects vertical BarChart.
 *
 * Project names resolved from `useProjectsList` SSoT (cached). Bar click →
 * drill-down to PO list filtered by `projectId` + current filter forwarding.
 *
 * @see ADR-331 §2.5, §4 D4, D5, D22, D23
 */

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useAuth } from '@/auth/contexts/AuthContext';
import { useProjectsList } from '@/hooks/useProjectsList';
import { formatCurrency } from '@/lib/intl-formatting';
import { KpiChartSkeleton } from '@/components/projects/procurement/overview/skeleton/KpiSkeleton';
import type {
  ProjectPoint,
  SpendAnalyticsFilters,
} from '@/services/procurement/aggregators/spendAnalyticsAggregator';
import {
  buildPurchaseOrdersUrl,
  CHART_FIGURE_CLASSES,
  formatEurShort,
  readClickedRowKey,
  truncateLabel,
} from './chart-utils';
import { ChartTooltip } from './chart-tooltip';

interface SpendByProjectChartProps {
  data: readonly ProjectPoint[];
  filters: SpendAnalyticsFilters;
  isLoading: boolean;
  className?: string;
}

interface ProjectRow {
  projectId: string;
  label: string;
  total: number;
}

export function SpendByProjectChart({
  data,
  filters,
  isLoading,
  className,
}: SpendByProjectChartProps) {
  const { t } = useTranslation('procurement');
  const router = useRouter();
  const { isAuthenticated, loading: authLoading } = useAuth();
  const { projects } = useProjectsList({ enabled: !authLoading && isAuthenticated });

  const rows = useMemo<ProjectRow[]>(() => {
    const nameById = new Map(projects.map((p) => [p.id, p.name]));
    return data.map((point) => ({
      projectId: point.projectId,
      label: truncateLabel(nameById.get(point.projectId) ?? point.projectId, 22),
      total: point.total,
    }));
  }, [data, projects]);

  if (isLoading) return <KpiChartSkeleton />;

  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {t('analytics.charts.byProject.title')}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            {t('analytics.charts.byProject.empty')}
          </p>
        ) : (
          <figure aria-label={t('analytics.charts.byProject.ariaLabel')} className={CHART_FIGURE_CLASSES}>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={rows} margin={{ top: 8, right: 16, left: 4, bottom: 16 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11 }}
                  interval={0}
                  angle={-25}
                  textAnchor="end"
                  height={56}
                />
                <YAxis tickFormatter={formatEurShort} tick={{ fontSize: 11 }} width={56} />
                <Tooltip
                  content={<ChartTooltip formatter={(value) => formatCurrency(value, 'EUR')} />}
                />
                <Bar
                  dataKey="total"
                  fill="hsl(var(--chart-1))"
                  radius={[3, 3, 0, 0]}
                  maxBarSize={36}
                  cursor="pointer"
                  onClick={(payload) => {
                    const projectId = readClickedRowKey(payload, 'projectId');
                    if (!projectId) return;
                    router.push(
                      buildPurchaseOrdersUrl(filters, { projectId: [projectId] }),
                      { scroll: false },
                    );
                  }}
                />
              </BarChart>
            </ResponsiveContainer>
          </figure>
        )}
      </CardContent>
    </Card>
  );
}
