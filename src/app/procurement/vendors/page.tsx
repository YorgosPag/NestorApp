'use client';

import { Users2 } from 'lucide-react';
import { ProcurementSubNav } from '@/subapps/procurement/components/ProcurementSubNav';
import { PageContainer } from '@/core/containers';
import { useTranslation } from '@/i18n/hooks/useTranslation';

export default function VendorsPage() {
  const { t } = useTranslation('procurement');

  return (
    <PageContainer ariaLabel={t('hub.vendorMaster.title')}>
      <div className="px-2 mt-2">
        <ProcurementSubNav className="mb-0" />
      </div>
      <div className="flex flex-col items-center justify-center gap-4 p-12 text-center">
        <Users2 className="h-16 w-16 text-green-600 opacity-50" aria-hidden />
        <h2 className="text-2xl font-semibold">{t('hub.vendorMaster.title')}</h2>
        <p className="max-w-md text-muted-foreground">{t('hub.vendorMaster.description')}</p>
        <p className="text-sm font-medium text-green-600">{t('hub.vendorMaster.comingSoon')}</p>
      </div>
    </PageContainer>
  );
}
