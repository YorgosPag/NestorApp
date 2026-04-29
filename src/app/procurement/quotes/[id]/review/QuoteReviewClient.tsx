'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useQuote } from '@/subapps/procurement/hooks/useQuote';
import { useContactById } from '@/hooks/useContactById';
import { ExtractedDataReviewPanel } from '@/subapps/procurement/components/ExtractedDataReviewPanel';
import { QuoteOriginalDocumentPanel } from '@/subapps/procurement/components/QuoteOriginalDocumentPanel';
import { useAuth } from '@/auth/hooks/useAuth';
import type { QuoteLine } from '@/subapps/procurement/types/quote';

interface QuoteReviewClientProps {
  id: string;
}

export function QuoteReviewClient({ id }: QuoteReviewClientProps) {
  const { t } = useTranslation('quotes');
  const router = useRouter();
  const { quote, loading, error, notFound, refetch } = useQuote(id, {
    pollIntervalMs: 2000,
    stopWhen: (q) =>
      q !== null && (q.extractedData !== null || (q.source !== 'scan' && q.source !== 'email_inbox')),
  });
  const supplierContact = useContactById(quote?.vendorContactId ?? null);
  const { user } = useAuth();
  const companyId = user?.companyId ?? '';
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [switchingVendor, setSwitchingVendor] = useState(false);

  const handleBack = useCallback(() => {
    if (quote?.rfqId && !quote.rfqId.startsWith('[')) {
      router.push(`/procurement/rfqs/${quote.rfqId}`);
    } else {
      router.push('/procurement/quotes');
    }
  }, [quote?.rfqId, router]);

  const handleConfirm = async (lines: QuoteLine[]) => {
    setSaving(true);
    setSaveError(null);
    try {
      const body: { lines: QuoteLine[]; status?: 'under_review' } = { lines };
      if (quote && quote.status !== 'under_review') {
        body.status = 'under_review';
      }
      const res = await fetch(`/api/quotes/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || `Update failed: ${res.status}`);
      }
      toast.success(t('quotes.saveSuccess'), {
        description: quote?.displayNumber ? `${t('quotes.number')}: ${quote.displayNumber}` : undefined,
      });
      router.refresh();
      handleBack();
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : t('quotes.errors.updateFailed'));
      setSaving(false);
    }
  };

  const handleSwitchVendor = async (
    name: string | null,
    vat: string | null,
    phone: string | null,
    emails: string[],
    vendorAddress: string | null,
    vendorCity: string | null,
    vendorPostalCode: string | null,
    vendorCountry: string | null,
    bankAccounts: Array<{ bankName: string; bic: string | null; iban: string; currency: string | null; accountHolder: string | null }> = [],
    logoUrl: string | null = null,
  ) => {
    setSwitchingVendor(true);
    setSaveError(null);
    try {
      const resolveRes = await fetch('/api/contacts/resolve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vatNumber: vat, name, phone, emails, logoUrl, vendorAddress, vendorCity, vendorPostalCode, vendorCountry, bankAccounts }),
      });
      if (!resolveRes.ok) throw new Error(await resolveRes.text());
      const resolveJson = await resolveRes.json();
      const contactId = resolveJson?.data?.contactId as string | undefined;
      const wasCreated = resolveJson?.data?.wasCreated as boolean | undefined;
      const resolvedName = resolveJson?.data?.displayName as string | undefined;
      if (!contactId) throw new Error('No contactId returned');

      if (wasCreated && resolvedName) {
        toast.success(t('quotes.notifications.vendorCreated', { vendorName: resolvedName }));
      }

      const patchRes = await fetch(`/api/quotes/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vendorContactId: contactId }),
      });
      if (!patchRes.ok) throw new Error(await patchRes.text());

      router.refresh();
      await refetch();
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : t('quotes.errors.updateFailed'));
    } finally {
      setSwitchingVendor(false);
    }
  };

  const handleArchive = async () => {
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch(`/api/quotes/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error(await res.text());
      toast.warning(t('quotes.archivedMessage'), {
        action: {
          label: t('quotes.undo'),
          onClick: async () => {
            await fetch(`/api/quotes/${id}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ status: 'draft' }),
            });
            router.push(`/procurement/quotes/${id}/review`);
          },
        },
        duration: 5000,
      });
      handleBack();
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : t('quotes.errors.updateFailed'));
      setSaving(false);
    }
  };

  return (
    <main className="container mx-auto max-w-7xl space-y-4 py-6">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={handleBack}>
          <ArrowLeft className="mr-1 h-4 w-4" />
          {quote?.rfqId && !quote.rfqId.startsWith('[') ? t('quotes.scan.backToRfq') : t('rfqs.title')}
        </Button>
        {quote && (
          <span className="text-sm text-muted-foreground">
            {t('quotes.number')}: <span className="font-mono">{quote.displayNumber}</span>
          </span>
        )}
      </div>

      {loading && !quote && !notFound && (
        <Card>
          <CardContent className="flex items-center justify-center gap-2 py-10 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            {t('quotes.loading')}
          </CardContent>
        </Card>
      )}

      {notFound && (
        <Card>
          <CardContent className="space-y-3 py-10 text-center">
            <p className="text-sm font-medium text-destructive">{t('quotes.notFound.title')}</p>
            <p className="text-xs text-muted-foreground">{t('quotes.notFound.hint')}</p>
            <Button variant="outline" size="sm" onClick={handleBack}>
              {t('quotes.notFound.goBack')}
            </Button>
          </CardContent>
        </Card>
      )}

      {error && !notFound && (
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

      {quote && quote.extractedData && companyId && (
        <>
          {saveError && <p className="text-sm text-destructive">{saveError}</p>}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <QuoteOriginalDocumentPanel
              quoteId={quote.id}
              companyId={companyId}
              sticky
            />
            <ExtractedDataReviewPanel
              quote={quote}
              supplierContact={supplierContact}
              onConfirm={handleConfirm}
              onReject={handleArchive}
              onGoBack={handleBack}
              onSwitchVendor={handleSwitchVendor}
              isSaving={saving}
              isSwitchingVendor={switchingVendor}
            />
          </div>
        </>
      )}
    </main>
  );
}
