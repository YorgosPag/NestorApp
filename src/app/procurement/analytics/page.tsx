'use client';

import { BarChart3 } from 'lucide-react';
import { ProcurementSubNav } from '@/subapps/procurement/components/ProcurementSubNav';
import { PageContainer } from '@/core/containers';
import { useTranslation } from '@/i18n/hooks/useTranslation';

export default function AnalyticsPage() {
  const { t } = useTranslation('procurement');

  return (
    <PageContainer ariaLabel={t('hub.spendAnalytics.title')}>
      <div className="px-2 mt-2">
        <ProcurementSubNav className="mb-0" />
      </div>
      <div className="flex flex-col items-center justify-center gap-4 p-12 text-center">
        <BarChart3 className="h-16 w-16 text-red-600 opacity-50" aria-hidden />
        <h2 className="text-2xl font-semibold">{t('hub.spendAnalytics.title')}</h2>
        <p className="max-w-md text-muted-foreground">{t('hub.spendAnalytics.description')}</p>
        <p className="text-sm font-medium text-red-600">{t('hub.spendAnalytics.comingSoon')}</p>
      </div>
    </PageContainer>
  );
}
