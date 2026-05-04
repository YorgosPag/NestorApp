'use client';

import { useRouter } from 'next/navigation';
import { ProcurementSubNav } from '@/subapps/procurement/components/ProcurementSubNav';
import { QuoteList } from '@/subapps/procurement/components/QuoteList';
import { useQuotes } from '@/subapps/procurement/hooks/useQuotes';
import { PageContainer } from '@/core/containers';
import { useTranslation } from '@/i18n/hooks/useTranslation';

export default function QuotesPage() {
  const { t } = useTranslation('procurement');
  const router = useRouter();
  const { quotes, loading } = useQuotes();

  return (
    <PageContainer ariaLabel={t('nav.quotes')}>
      <div className="px-2 mt-2">
        <ProcurementSubNav className="mb-0" />
      </div>
      <div className="p-4">
        <QuoteList
          quotes={quotes}
          loading={loading}
          onCreateNew={() => router.push('/procurement/quotes/scan')}
        />
      </div>
    </PageContainer>
  );
}
