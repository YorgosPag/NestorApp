'use client';

import { use, useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Plus, ScanLine } from 'lucide-react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useQuotes } from '@/subapps/procurement/hooks/useQuotes';
import { useComparison } from '@/subapps/procurement/hooks/useComparison';
import { QuoteList } from '@/subapps/procurement/components/QuoteList';
import { QuoteForm } from '@/subapps/procurement/components/QuoteForm';
import { ComparisonPanel } from '@/subapps/procurement/components/ComparisonPanel';
import { VendorInviteSection } from '@/subapps/procurement/components/VendorInviteSection';
import type { RFQ } from '@/subapps/procurement/types/rfq';
import { rfqIsMultiTrade } from '@/subapps/procurement/types/rfq';

interface RfqDetailPageProps {
  params: Promise<{ id: string }>;
}

export default function RfqDetailPage({ params }: RfqDetailPageProps) {
  const { id } = use(params);
  const { t } = useTranslation('quotes');
  const router = useRouter();
  const { quotes, loading, refetch } = useQuotes({ rfqId: id });
  const [showQuoteForm, setShowQuoteForm] = useState(false);
  const [rfq, setRfq] = useState<RFQ | null>(null);

  const fetchRfq = useCallback(async () => {
    try {
      const res = await fetch(`/api/rfqs/${id}`);
      if (!res.ok) return;
      const json = await res.json();
      setRfq((json?.data ?? null) as RFQ | null);
    } catch {
      // silent — scan button will fall back to manual selectors
    }
  }, [id]);

  useEffect(() => {
    void fetchRfq();
  }, [fetchRfq]);

  const cherryPickEnabled = rfq?.awardMode === 'cherry_pick';
  const { comparison, cherryPick, loading: comparisonLoading, refetch: refetchComparison } =
    useComparison(id, { cherryPick: cherryPickEnabled });

  const handleAward = useCallback(async (winnerQuoteId: string, overrideReason: string | null) => {
    const res = await fetch(`/api/rfqs/${id}/award`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        winnerQuoteId,
        ...(overrideReason ? { overrideReason } : {}),
      }),
    });
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      throw new Error(json?.error ?? `Award failed (${res.status})`);
    }
    await Promise.all([fetchRfq(), refetch(), refetchComparison()]);
  }, [id, fetchRfq, refetch, refetchComparison]);

  const handleViewQuote = useCallback(
    (quoteId: string) => router.push(`/procurement/quotes/${quoteId}/review`),
    [router],
  );

  const scanHref = useMemo(() => {
    const params = new URLSearchParams({ rfqId: id });
    if (rfq) {
      params.set('projectId', rfq.projectId);
      if (!rfqIsMultiTrade(rfq) && rfq.lines.length > 0) {
        params.set('trade', rfq.lines[0].trade);
      }
    }
    return `/procurement/quotes/scan?${params.toString()}`;
  }, [id, rfq]);

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

      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-semibold">{t('rfqs.quotesSection')}</h1>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push(scanHref)}
            title={t('quotes.scan.scanFromRfqHint')}
          >
            <ScanLine className="mr-1 h-4 w-4" />
            {t('quotes.scan.scanFromRfq')}
          </Button>
          {!showQuoteForm && (
            <Button size="sm" onClick={() => setShowQuoteForm(true)}>
              <Plus className="mr-1 h-4 w-4" />
              {t('quotes.create')}
            </Button>
          )}
        </div>
      </div>

      {showQuoteForm && (
        <QuoteForm
          rfqId={id}
          onSuccess={handleQuoteCreated}
          onCancel={() => setShowQuoteForm(false)}
        />
      )}

      <QuoteList quotes={quotes} loading={loading} onView={handleViewQuote} />

      {comparison && (
        <ComparisonPanel
          comparison={comparison}
          cherryPick={cherryPick}
          loading={comparisonLoading}
          rfqAwarded={Boolean(rfq?.winnerQuoteId)}
          awardMode={rfq?.awardMode ?? 'whole_package'}
          onAward={handleAward}
        />
      )}

      <VendorInviteSection rfqId={id} />
    </main>
  );
}
