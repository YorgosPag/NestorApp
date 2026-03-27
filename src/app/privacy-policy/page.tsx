'use client';

import '@/lib/design-system';
import { useTranslation } from '@/i18n/hooks/useTranslation';

export default function PrivacyPolicyPage() {
  const { t } = useTranslation('legal');

  return (
    <main className="max-w-3xl mx-auto px-4 py-8">
      <h1>{t('privacyPolicy.title')}</h1>
      <p>
        <strong>{t('privacyPolicy.lastUpdated')}</strong> {t('privacyPolicy.lastUpdatedDate')}
      </p>

      <h2>{t('privacyPolicy.introduction.title')}</h2>
      <p>{t('privacyPolicy.introduction.content')}</p>

      <h2>{t('privacyPolicy.dataWeCollect.title')}</h2>
      <ul>
        <li>{t('privacyPolicy.dataWeCollect.item1')}</li>
        <li>{t('privacyPolicy.dataWeCollect.item2')}</li>
        <li>{t('privacyPolicy.dataWeCollect.item3')}</li>
      </ul>

      <h2>{t('privacyPolicy.howWeUse.title')}</h2>
      <ul>
        <li>{t('privacyPolicy.howWeUse.item1')}</li>
        <li>{t('privacyPolicy.howWeUse.item2')}</li>
        <li>{t('privacyPolicy.howWeUse.item3')}</li>
      </ul>

      <h2>{t('privacyPolicy.dataSharing.title')}</h2>
      <p>{t('privacyPolicy.dataSharing.content')}</p>

      <h2>{t('privacyPolicy.dataRetention.title')}</h2>
      <p>{t('privacyPolicy.dataRetention.content')}</p>

      <h2>{t('privacyPolicy.yourRights.title')}</h2>
      <p dangerouslySetInnerHTML={{ __html: t('privacyPolicy.yourRights.content') }} />

      <h2>{t('privacyPolicy.contact.title')}</h2>
      <p dangerouslySetInnerHTML={{ __html: t('privacyPolicy.contact.text') }} />
    </main>
  );
}
