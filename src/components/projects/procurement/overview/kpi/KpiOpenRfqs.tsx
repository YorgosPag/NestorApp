'use client';

import { FileSearch } from 'lucide-react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { getProjectProcurementUrl } from '@/lib/navigation/procurement-urls';
import { RFQ_OPEN_STATUSES } from '@/subapps/procurement/types/rfq';
import type { ProjectProcurementStats } from '@/hooks/useProjectProcurementStats';
import { KpiCard } from './KpiCard';

interface Props {
  projectId: string;
  stats: ProjectProcurementStats | null;
}

/** Το ίδιο σύνολο που μετρά ο aggregator — η λίστα δείχνει ΑΚΡΙΒΩΣ ό,τι μέτρησε η κάρτα. */
const OPEN_RFQ_STATUSES = [...RFQ_OPEN_STATUSES];

export function KpiOpenRfqs({ projectId, stats }: Props) {
  const { t } = useTranslation('procurement');
  const count = stats?.openRfqCount ?? 0;

  return (
    <KpiCard
      label={t('overview.kpi.openRfqs.label')}
      icon={FileSearch}
      href={count > 0 ? getProjectProcurementUrl(projectId, 'rfq', { status: OPEN_RFQ_STATUSES }) : undefined}
    >
      <p className="text-3xl font-bold tabular-nums">{count}</p>
      {count === 0 && (
        <p className="text-xs text-muted-foreground mt-1">
          {t('overview.kpi.openRfqs.empty')}
        </p>
      )}
    </KpiCard>
  );
}
