'use client';

import { ScrollText } from 'lucide-react';
import { ProcurementSubNav } from '@/subapps/procurement/components/ProcurementSubNav';
import { PageContainer } from '@/core/containers';
import { useTranslation } from '@/i18n/hooks/useTranslation';

export default function AgreementsPage() {
  const { t } = useTranslation('procurement');

  return (
    <PageContainer ariaLabel={t('hub.frameworkAgreements.title')}>
      <div className="px-2 mt-2">
        <ProcurementSubNav className="mb-0" />
      </div>
      <div className="flex flex-col items-center justify-center gap-4 p-12 text-center">
        <ScrollText className="h-16 w-16 text-purple-600 opacity-50" aria-hidden />
        <h2 className="text-2xl font-semibold">{t('hub.frameworkAgreements.title')}</h2>
        <p className="max-w-md text-muted-foreground">{t('hub.frameworkAgreements.description')}</p>
        <p className="text-sm font-medium text-purple-600">{t('hub.frameworkAgreements.comingSoon')}</p>
      </div>
    </PageContainer>
  );
}
