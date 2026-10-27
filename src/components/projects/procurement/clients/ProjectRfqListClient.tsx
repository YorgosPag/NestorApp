'use client';

/**
 * @module components/projects/procurement/clients/ProjectRfqListClient
 * @enterprise ADR-330 §5.1 S2 — Project-scoped RFQ list wrapper
 *
 * Fetches RFQs filtered by `projectId` and renders the existing `RfqList`.
 * Detail navigation is handled inside `RfqList` itself via `procurement-urls`
 * SSoT helper (S1).
 *
 * S3.1 — honours the `?status=` drill-down of the overview cards (URL = SSoT).
 */

import { useMemo } from 'react';
import { useRouter } from '@/lib/workspace/navigation';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useRfqs } from '@/subapps/procurement/hooks/useRfqs';
import { RfqList } from '@/subapps/procurement/components/RfqList';
import { RFQ_STATUS_TRANSITIONS } from '@/subapps/procurement/types/rfq';
import { useStatusDrillParam } from './useStatusDrillParam';
import { StatusDrillNotice } from './StatusDrillNotice';

export interface ProjectRfqListClientProps {
  projectId: string;
}

export function ProjectRfqListClient({ projectId }: ProjectRfqListClientProps) {
  const router = useRouter();
  const { t } = useTranslation('quotes');
  const { rfqs, loading } = useRfqs({ projectId });
  const drill = useStatusDrillParam(RFQ_STATUS_TRANSITIONS);

  const visibleRfqs = useMemo(
    () => (drill.statuses.length === 0 ? rfqs : rfqs.filter((r) => drill.statuses.includes(r.status))),
    [rfqs, drill.statuses],
  );

  const handleCreate = () => {
    router.push(`/procurement/rfqs/new?projectId=${projectId}`);
  };

  return (
    <>
      <StatusDrillNotice
        labels={drill.statuses.map((s) => t(`rfqs.statuses.${s}`))}
        onClear={drill.clear}
      />
      <RfqList rfqs={visibleRfqs} loading={loading} onCreateRfq={handleCreate} />
    </>
  );
}
