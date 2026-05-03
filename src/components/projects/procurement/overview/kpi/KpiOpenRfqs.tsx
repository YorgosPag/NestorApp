'use client';

import { FileSearch } from 'lucide-react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { ProjectProcurementStats } from '@/hooks/useProjectProcurementStats';

interface Props {
  stats: ProjectProcurementStats | null;
}

export function KpiOpenRfqs({ stats }: Props) {
  const { t } = useTranslation('procurement');

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {t('overview.kpi.openRfqs.label')}
        </CardTitle>
        <FileSearch className="h-4 w-4 text-muted-foreground" aria-hidden />
      </CardHeader>
      <CardContent>
        <p className="text-3xl font-bold tabular-nums">{stats?.openRfqCount ?? 0}</p>
        {stats?.openRfqCount === 0 && (
          <p className="text-xs text-muted-foreground mt-1">
            {t('overview.kpi.openRfqs.empty')}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
