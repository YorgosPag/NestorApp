'use client';

import { useMemo } from 'react';
import { ProcurementSubNav } from '@/subapps/procurement/components/ProcurementSubNav';
import { RfqList } from '@/subapps/procurement/components/RfqList';
import { useRfqs } from '@/subapps/procurement/hooks/useRfqs';
import { RFQ_STATUS_TRANSITIONS } from '@/subapps/procurement/types/rfq';
import { useStatusDrillParam } from '@/components/projects/procurement/clients/useStatusDrillParam';
import { applyStatusDrill } from '@/components/projects/procurement/clients/status-filter-card';
import { StatusDrillNotice } from '@/components/projects/procurement/clients/StatusDrillNotice';
import { PageContainer } from '@/core/containers';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import routeSlice from '@/i18n/generated/routes/o__workspace__procurement__rfqs.el.json';
import { registerRouteSlice } from '@/i18n/route-slice';

registerRouteSlice(routeSlice);

/** Η λίστα RFQ όλης της εταιρείας· τιμά το `?status=` της κάρτας «N ενεργά» του hub (ADR-330 §5.1 S3.4). */
export default function RfqsPage() {
  const { t } = useTranslation('procurement');
  const { t: tQ } = useTranslation('quotes');
  const { rfqs, loading } = useRfqs();
  const drill = useStatusDrillParam(RFQ_STATUS_TRANSITIONS);
  const visibleRfqs = useMemo(() => applyStatusDrill(rfqs, drill.statuses, (r) => r.status), [rfqs, drill.statuses]);

  return (
    <PageContainer ariaLabel={t('nav.rfqs')}>
      <div className="px-2 mt-2">
        <ProcurementSubNav className="mb-0" />
      </div>
      <div className="p-4">
        <StatusDrillNotice
          labels={drill.statuses.map((s) => tQ(`rfqs.statuses.${s}`))}
          onClear={drill.clear}
        />
        <RfqList rfqs={visibleRfqs} loading={loading} />
      </div>
    </PageContainer>
  );
}
