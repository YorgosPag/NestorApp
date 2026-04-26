'use client';

import { use, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useQuote } from '@/subapps/procurement/hooks/useQuote';
import { ExtractedDataReviewPanel } from '@/subapps/procurement/components/ExtractedDataReviewPanel';
import type { QuoteLine } from '@/subapps/procurement/types/quote';

interface ReviewPageProps {
  params: Promise<{ id: string }>;
}

export default function QuoteReviewPage({ params }: ReviewPageProps) {
  const { id } = use(params);
  const { t } = useTranslation('quotes');
  const router = useRouter();
  const { quote, loading, error, refetch } = useQuote(id, {
    pollIntervalMs: 2000,
    stopWhen: (q) => q !== null && q.extractedData !== null,
  });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const handleBack = useCallback(() => {
    if (quote?.rfqId) {
      router.push(`/procurement/rfqs/${quote.rfqId}`);
    } else {
      router.push('/procurement/rfqs');
    }
  }, [quote?.rfqId, router]);

  const handleConfirm = async (lines: QuoteLine[]) => {
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch(`/api/quotes/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lines, status: 'submitted' }),
      });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || `Update failed: ${res.status}`);
      }
      handleBack();
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : t('quotes.errors.updateFailed'));
      setSaving(false);
    }
  };

  const handleReject = async () => {
    setSaving(true);
    try {
      await fetch(`/api/quotes/${id}`, { method: 'DELETE' });
    } finally {
      handleBack();
    }
  };

  return (
    <main className="container mx-auto max-w-5xl space-y-4 py-6">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={handleBack}>
          <ArrowLeft className="mr-1 h-4 w-4" />
          {quote?.rfqId ? t('quotes.scan.backToRfq') : t('rfqs.title')}
        </Button>
        {quote && (
          <span className="text-sm text-muted-foreground">
            {t('quotes.number')}: <span className="font-mono">{quote.displayNumber}</span>
          </span>
        )}
      </div>

      {loading && !quote && (
        <Card>
          <CardContent className="flex items-center justify-center gap-2 py-10 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            {t('quotes.loading')}
          </CardContent>
        </Card>
      )}

      {error && (
        <Card>
          <CardContent className="py-6 text-sm text-destructive">
            {error}
            <Button variant="outline" size="sm" className="ml-2" onClick={() => void refetch()}>
              {t('quotes.scan.retry')}
            </Button>
          </CardContent>
        </Card>
      )}

      {quote && !quote.extractedData && (
        <Card>
          <CardContent className="space-y-2 py-10 text-center">
            <Loader2 className="mx-auto h-5 w-5 animate-spin text-muted-foreground" />
            <p className="text-sm font-medium">{t('quotes.scan.processing')}</p>
            <p className="text-xs text-muted-foreground">{t('quotes.scan.processingHint')}</p>
          </CardContent>
        </Card>
      )}

      {quote && quote.extractedData && (
        <>
          {saveError && <p className="text-sm text-destructive">{saveError}</p>}
          <ExtractedDataReviewPanel
            quote={quote}
            onConfirm={handleConfirm}
            onReject={handleReject}
            isSaving={saving}
          />
        </>
      )}
    </main>
  );
}
