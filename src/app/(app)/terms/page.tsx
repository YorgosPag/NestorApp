'use client';

import '@/lib/design-system';
import { useTranslation } from '@/i18n/hooks/useTranslation';

export default function TermsOfServicePage() {
  const { t } = useTranslation('legal');

  return (
    <main className="max-w-3xl mx-auto px-4 py-8">
      <h1>{t('termsOfService.title')}</h1>
      <p>
        <strong>{t('termsOfService.lastUpdated')}</strong> {t('termsOfService.lastUpdatedDate')}
      </p>

      <h2>{t('termsOfService.acceptance.title')}</h2>
      <p>{t('termsOfService.acceptance.content')}</p>

      <h2>{t('termsOfService.services.title')}</h2>
      <p>{t('termsOfService.services.content')}</p>

      <h2>{t('termsOfService.userResponsibilities.title')}</h2>
      <ul>
        <li>{t('termsOfService.userResponsibilities.item1')}</li>
        <li>{t('termsOfService.userResponsibilities.item2')}</li>
        <li>{t('termsOfService.userResponsibilities.item3')}</li>
      </ul>

      <h2>{t('termsOfService.limitation.title')}</h2>
      <p>{t('termsOfService.limitation.content')}</p>

      <h2>{t('termsOfService.changes.title')}</h2>
      <p>{t('termsOfService.changes.content')}</p>

      <h2>{t('termsOfService.contact.title')}</h2>
      <p dangerouslySetInnerHTML={{ __html: t('termsOfService.contact.text') }} />
    </main>
  );
}
