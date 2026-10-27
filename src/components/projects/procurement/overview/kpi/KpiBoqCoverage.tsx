'use client';

import { Layers } from 'lucide-react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { Progress } from '@/components/ui/progress';
import { getProjectTabUrl } from '@/lib/navigation/project-urls';
import type { ProjectProcurementStats } from '@/hooks/useProjectProcurementStats';
import { KpiCard } from './KpiCard';

interface Props {
  projectId: string;
  stats: ProjectProcurementStats | null;
}

export function KpiBoqCoverage({ projectId, stats }: Props) {
  const { t } = useTranslation('procurement');
  const coverage = stats?.boqCoverage;
  const pct = coverage?.percentage ?? 0;
  const hasBoq = (coverage?.totalCount ?? 0) > 0;

  return (
    <KpiCard
      label={t('overview.kpi.boqCoverage.label')}
      icon={Layers}
      href={hasBoq ? getProjectTabUrl(projectId, 'measurements') : undefined}
    >
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
    </KpiCard>
  );
}
