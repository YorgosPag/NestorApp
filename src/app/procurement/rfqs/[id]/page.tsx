'use client';

import { use, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Plus } from 'lucide-react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useQuotes } from '@/subapps/procurement/hooks/useQuotes';
import { QuoteList } from '@/subapps/procurement/components/QuoteList';
import { QuoteForm } from '@/subapps/procurement/components/QuoteForm';
import { ComparisonPanelStub } from '@/subapps/procurement/components/ComparisonPanelStub';

interface RfqDetailPageProps {
  params: Promise<{ id: string }>;
}

export default function RfqDetailPage({ params }: RfqDetailPageProps) {
  const { id } = use(params);
  const { t } = useTranslation('quotes');
  const router = useRouter();
  const { quotes, loading, refetch } = useQuotes({ rfqId: id });
  const [showQuoteForm, setShowQuoteForm] = useState(false);

  const handleQuoteCreated = async () => {
    setShowQuoteForm(false);
    await refetch();
  };

  return (
    <main className="container mx-auto max-w-5xl space-y-6 py-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => router.push('/procurement/rfqs')}>
          <ArrowLeft className="mr-1 h-4 w-4" />
          {t('rfqs.title')}
        </Button>
      </div>

      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">{t('rfqs.quotesSection')}</h1>
        {!showQuoteForm && (
          <Button size="sm" onClick={() => setShowQuoteForm(true)}>
            <Plus className="mr-1 h-4 w-4" />
            {t('quotes.create')}
          </Button>
        )}
      </div>

      {showQuoteForm && (
        <QuoteForm
          rfqId={id}
          onSuccess={handleQuoteCreated}
          onCancel={() => setShowQuoteForm(false)}
        />
      )}

      <QuoteList quotes={quotes} loading={loading} />

      <ComparisonPanelStub />
    </main>
  );
}
