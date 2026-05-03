'use client';

import { Layers } from 'lucide-react';
import { ProcurementSubNav } from '@/subapps/procurement/components/ProcurementSubNav';
import { PageContainer } from '@/core/containers';
import { useTranslation } from '@/i18n/hooks/useTranslation';

export default function MaterialsPage() {
  const { t } = useTranslation('procurement');

  return (
    <PageContainer ariaLabel={t('hub.materialCatalog.title')}>
      <div className="px-2 mt-2">
        <ProcurementSubNav className="mb-0" />
      </div>
      <div className="flex flex-col items-center justify-center gap-4 p-12 text-center">
        <Layers className="h-16 w-16 text-yellow-600 opacity-50" aria-hidden />
        <h2 className="text-2xl font-semibold">{t('hub.materialCatalog.title')}</h2>
        <p className="max-w-md text-muted-foreground">{t('hub.materialCatalog.description')}</p>
        <p className="text-sm font-medium text-yellow-600">{t('hub.materialCatalog.comingSoon')}</p>
      </div>
    </PageContainer>
  );
}
