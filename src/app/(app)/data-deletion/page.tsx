'use client';

import '@/lib/design-system';
import { useTranslation } from '@/i18n/hooks/useTranslation';

export default function DataDeletionPage() {
  const { t } = useTranslation('legal');

  return (
    <main className="max-w-3xl mx-auto px-4 py-8">
      <h1>{t('dataDeletion.title')}</h1>
      <p>
        <strong>{t('dataDeletion.lastUpdated')}</strong> {t('dataDeletion.lastUpdatedDate')}
      </p>

      <h2>{t('dataDeletion.howToRequest.title')}</h2>
      <p>{t('dataDeletion.howToRequest.intro')}</p>

      <ol>
        <li dangerouslySetInnerHTML={{ __html: t('dataDeletion.howToRequest.step1') }} />
        <li>{t('dataDeletion.howToRequest.step2')}</li>
        <li>{t('dataDeletion.howToRequest.step3')}</li>
      </ol>

      <h2>{t('dataDeletion.whatWeDelete.title')}</h2>
      <ul>
        <li>{t('dataDeletion.whatWeDelete.item1')}</li>
        <li>{t('dataDeletion.whatWeDelete.item2')}</li>
        <li>{t('dataDeletion.whatWeDelete.item3')}</li>
      </ul>

      <h2>{t('dataDeletion.contact.title')}</h2>
      <p dangerouslySetInnerHTML={{ __html: t('dataDeletion.contact.text') }} />
    </main>
  );
}
