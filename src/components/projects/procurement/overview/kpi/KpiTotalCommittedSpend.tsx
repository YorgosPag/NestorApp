'use client';

import { Euro } from 'lucide-react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { ProjectProcurementStats } from '@/hooks/useProjectProcurementStats';

interface Props {
  stats: ProjectProcurementStats | null;
}

function formatEur(n: number): string {
  return new Intl.NumberFormat('el-GR', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);
}

export function KpiTotalCommittedSpend({ stats }: Props) {
  const { t } = useTranslation('procurement');
  const spend = stats?.totalCommittedSpend ?? 0;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {t('overview.kpi.committedSpend.label')}
        </CardTitle>
        <Euro className="h-4 w-4 text-muted-foreground" aria-hidden />
      </CardHeader>
      <CardContent>
        <p className="text-3xl font-bold tabular-nums">{formatEur(spend)}</p>
        {spend === 0 && (
          <p className="text-xs text-muted-foreground mt-1">
            {t('overview.kpi.committedSpend.empty')}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
