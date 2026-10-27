'use client';

import { Euro } from 'lucide-react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { getProjectProcurementUrl } from '@/lib/navigation/procurement-urls';
import { PO_COMMITTED_STATUSES } from '@/types/procurement';
import type { ProjectProcurementStats } from '@/hooks/useProjectProcurementStats';
import { KpiCard } from './KpiCard';

interface Props {
  projectId: string;
  stats: ProjectProcurementStats | null;
}

/** Το ίδιο σύνολο που αθροίζει ο aggregator — η λίστα δείχνει ΑΚΡΙΒΩΣ ό,τι μέτρησε η κάρτα. */
const COMMITTED_PO_STATUSES = [...PO_COMMITTED_STATUSES];

function formatEur(n: number): string {
  return new Intl.NumberFormat('el-GR', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);
}

export function KpiTotalCommittedSpend({ projectId, stats }: Props) {
  const { t } = useTranslation('procurement');
  const spend = stats?.totalCommittedSpend ?? 0;

  return (
    <KpiCard
      label={t('overview.kpi.committedSpend.label')}
      icon={Euro}
      href={spend > 0 ? getProjectProcurementUrl(projectId, 'po', { status: COMMITTED_PO_STATUSES }) : undefined}
    >
      <p className="text-3xl font-bold tabular-nums">{formatEur(spend)}</p>
      {spend === 0 && (
        <p className="text-xs text-muted-foreground mt-1">
          {t('overview.kpi.committedSpend.empty')}
        </p>
      )}
    </KpiCard>
  );
}
