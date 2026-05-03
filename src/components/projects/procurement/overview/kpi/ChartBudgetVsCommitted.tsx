'use client';

import { useTranslation } from '@/i18n/hooks/useTranslation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import type { ProjectProcurementStats } from '@/hooks/useProjectProcurementStats';

interface Props {
  stats: ProjectProcurementStats | null;
}

function formatEurShort(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M€`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K€`;
  return `${n.toFixed(0)}€`;
}

export function ChartBudgetVsCommitted({ stats }: Props) {
  const { t } = useTranslation('procurement');
  const data = stats?.budgetVsCommitted ?? [];

  return (
    <Card className="col-span-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {t('overview.kpi.budgetVsCommitted.label')}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            {t('overview.kpi.budgetVsCommitted.noBoq')}
          </p>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="categoryCode" tick={{ fontSize: 11 }} />
              <YAxis tickFormatter={formatEurShort} tick={{ fontSize: 11 }} width={52} />
              <Tooltip
                formatter={(value: number) => formatEurShort(value)}
                labelStyle={{ fontWeight: 600 }}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar
                dataKey="budget"
                name={t('overview.kpi.budgetVsCommitted.budget')}
                fill="hsl(var(--chart-1, 215 70% 50%))"
                radius={[3, 3, 0, 0]}
                maxBarSize={32}
              />
              <Bar
                dataKey="committed"
                name={t('overview.kpi.budgetVsCommitted.committed')}
                fill="hsl(var(--chart-2, 25 90% 55%))"
                radius={[3, 3, 0, 0]}
                maxBarSize={32}
              />
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
