'use client';

import { useTranslation } from '@/i18n/hooks/useTranslation';

export function CompanyInfoTab() {
  const { t } = useTranslation('org-structure');

  return (
    <div className="py-6 text-center text-sm text-muted-foreground">
      {t('orgStructure.tabs.info')} — {t('orgStructure.subtitle')}
    </div>
  );
}
