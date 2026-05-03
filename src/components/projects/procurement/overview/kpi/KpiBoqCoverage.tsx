'use client';

import { Layers } from 'lucide-react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import type { ProjectProcurementStats } from '@/hooks/useProjectProcurementStats';

interface Props {
  stats: ProjectProcurementStats | null;
}

export function KpiBoqCoverage({ stats }: Props) {
  const { t } = useTranslation('procurement');
  const coverage = stats?.boqCoverage;
  const pct = coverage?.percentage ?? 0;
  const hasBoq = (coverage?.totalCount ?? 0) > 0;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {t('overview.kpi.boqCoverage.label')}
        </CardTitle>
        <Layers className="h-4 w-4 text-muted-foreground" aria-hidden />
      </CardHeader>
      <CardContent>
        {!hasBoq ? (
          <p className="text-xs text-muted-foreground">
            {t('overview.kpi.boqCoverage.noBoq')}
          </p>
        ) : (
          <>
            <p className="text-3xl font-bold tabular-nums">{pct}%</p>
            <Progress value={pct} className="mt-2 h-2" />
            <p className="text-xs text-muted-foreground mt-1">
              {coverage?.coveredCount} / {coverage?.totalCount}
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
