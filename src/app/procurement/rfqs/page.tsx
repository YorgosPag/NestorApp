'use client';

import { ProcurementSubNav } from '@/subapps/procurement/components/ProcurementSubNav';
import { RfqList } from '@/subapps/procurement/components/RfqList';
import { useRfqs } from '@/subapps/procurement/hooks/useRfqs';
import { PageContainer } from '@/core/containers';
import { useTranslation } from '@/i18n/hooks/useTranslation';

export default function RfqsPage() {
  const { t } = useTranslation('procurement');
  const { rfqs, loading } = useRfqs();

  return (
    <PageContainer ariaLabel={t('nav.rfqs')}>
      <div className="px-2 mt-2">
        <ProcurementSubNav className="mb-0" />
      </div>
      <div className="p-4">
        <RfqList rfqs={rfqs} loading={loading} />
      </div>
    </PageContainer>
  );
}
