'use client';

import { ClipboardCheck } from 'lucide-react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { cn } from '@/lib/utils';
import { getProjectProcurementUrl } from '@/lib/navigation/procurement-urls';
import { PO_AWAITING_APPROVAL_STATUSES } from '@/types/procurement';
import type { ProjectProcurementStats } from '@/hooks/useProjectProcurementStats';
import { KpiCard } from './KpiCard';

interface Props {
  projectId: string;
  stats: ProjectProcurementStats | null;
}

/** Το ίδιο σύνολο που μετρά ο aggregator — η λίστα δείχνει ΑΚΡΙΒΩΣ ό,τι μέτρησε η κάρτα. */
const PENDING_APPROVAL_PO_STATUSES = [...PO_AWAITING_APPROVAL_STATUSES];

export function KpiPendingApprovalPos({ projectId, stats }: Props) {
  const { t } = useTranslation('procurement');
  const count = stats?.pendingApprovalPoCount ?? 0;

  return (
    <KpiCard
      label={t('overview.kpi.pendingPos.label')}
      icon={ClipboardCheck}
      href={count > 0 ? getProjectProcurementUrl(projectId, 'po', { status: PENDING_APPROVAL_PO_STATUSES }) : undefined}
    >
      <p className={cn('text-3xl font-bold tabular-nums', count > 0 && 'text-[hsl(var(--text-warning))]')}>
        {count}
      </p>
      {count === 0 && (
        <p className="text-xs text-muted-foreground mt-1">
          {t('overview.kpi.pendingPos.empty')}
        </p>
      )}
    </KpiCard>
  );
}
