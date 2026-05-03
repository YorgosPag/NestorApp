'use client';

import { ClipboardCheck } from 'lucide-react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { ProjectProcurementStats } from '@/hooks/useProjectProcurementStats';

interface Props {
  stats: ProjectProcurementStats | null;
}

export function KpiPendingApprovalPos({ stats }: Props) {
  const { t } = useTranslation('procurement');
  const count = stats?.pendingApprovalPoCount ?? 0;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {t('overview.kpi.pendingPos.label')}
        </CardTitle>
        <ClipboardCheck className="h-4 w-4 text-muted-foreground" aria-hidden />
      </CardHeader>
      <CardContent>
        <p className={cn('text-3xl font-bold tabular-nums', count > 0 && 'text-amber-600 dark:text-amber-400')}>
          {count}
        </p>
        {count === 0 && (
          <p className="text-xs text-muted-foreground mt-1">
            {t('overview.kpi.pendingPos.empty')}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
