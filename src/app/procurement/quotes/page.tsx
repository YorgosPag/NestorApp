'use client';

import { useCallback, useMemo, useState } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { FileText } from 'lucide-react';
import { ProcurementSubNav } from '@/subapps/procurement/components/ProcurementSubNav';
import { QuoteList } from '@/subapps/procurement/components/QuoteList';
import { QuoteRightPane } from '@/subapps/procurement/components/QuoteRightPane';
import { useQuotes } from '@/subapps/procurement/hooks/useQuotes';
import { buildQuoteHeaderActions } from '@/subapps/procurement/utils/quote-header-actions';
import { PageContainer, ListContainer, DetailsContainer } from '@/core/containers';
import { MobileDetailsSlideIn } from '@/core/layouts';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { useFirestoreStatus } from '@/hooks/useFirestoreStatus';
import { toast } from 'sonner';
import type { Quote } from '@/subapps/procurement/types/quote';

const ACTION_REQUIRED_STATUSES = new Set(['submitted', 'under_review', 'expired']);

export default function QuotesPage() {
  const { t } = useTranslation('procurement');
  const { t: tQ } = useTranslation('quotes');
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const isOnline = useOnlineStatus();
  const isFirestoreConnected = useFirestoreStatus();
  const isConnected = isOnline && isFirestoreConnected;

  const { quotes, loading } = useQuotes();

  // ── Master-detail: URL-persistent selection ──────────────────────────────
  const selectedQuoteId = searchParams.get('quoteId');
  const selectedQuote = useMemo(
    () => quotes.find((q) => q.id === selectedQuoteId) ?? null,
    [quotes, selectedQuoteId],
  );

  const handleSelectQuote = useCallback(
    (quote: Quote | null) => {
      const params = new URLSearchParams(searchParams.toString());
      if (quote) params.set('quoteId', quote.id);
      else params.delete('quoteId');
      router.replace(`${pathname}?${params.toString()}`);
    },
    [router, searchParams, pathname],
  );

  // ── Local UI state ────────────────────────────────────────────────────────
  const [pdfOpen, setPdfOpen] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(false);

  const handleTogglePdf = useCallback(() => setPdfOpen((v) => !v), []);
  const handleToggleComments = useCallback(() => setCommentsOpen((v) => !v), []);

  // ── Quote mutations ───────────────────────────────────────────────────────
  const patchQuoteStatus = useCallback(
    async (status: string) => {
      if (!selectedQuote) return;
      const res = await fetch(`/api/quotes/${selectedQuote.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) toast.error(tQ('quotes.errors.updateFailed'));
    },
    [selectedQuote, tQ],
  );

  const handleDeleteQuote = useCallback(async () => {
    if (!selectedQuote) return;
    const res = await fetch(`/api/quotes/${selectedQuote.id}`, { method: 'DELETE' });
    if (res.ok) handleSelectQuote(null);
    else toast.error(tQ('quotes.errors.updateFailed'));
  }, [selectedQuote, handleSelectQuote, tQ]);

  const handleStub = useCallback(
    () => void toast.info(tQ('rfqs.quoteHeader.tooltip.comingSoon')),
    [tQ],
  );

  // ── Action objects for QuoteRightPane ─────────────────────────────────────
  const { primaryActions, secondaryActions, overflowActions } = useMemo(
    () =>
      selectedQuote
        ? buildQuoteHeaderActions({
            quote: selectedQuote,
            rfq: null,
            onConfirm: () => void patchQuoteStatus('under_review'),
            onApprove: () => void patchQuoteStatus('accepted'),
            onReject: () => void patchQuoteStatus('rejected'),
            onRestore: () => void patchQuoteStatus('submitted'),
            onCreatePo: handleStub,
            onViewPo: handleStub,
            onDownload: handleTogglePdf,
            onOpenComments: handleToggleComments,
            onEdit: handleStub,
            onDuplicate: handleStub,
            onDelete: handleDeleteQuote,
            t: tQ,
            isConnected,
          })
        : { primaryActions: [], secondaryActions: [], overflowActions: [] },
    [
      selectedQuote,
      patchQuoteStatus,
      handleStub,
      handleTogglePdf,
      handleToggleComments,
      handleDeleteQuote,
      tQ,
      isConnected,
    ],
  );

  // ── Action-required: pin quotes needing decision at top ───────────────────
  const actionRequired = useMemo(
    () => quotes.filter((q) => ACTION_REQUIRED_STATUSES.has(q.status)),
    [quotes],
  );

  const listProps = {
    quotes,
    actionRequired,
    loading,
    onCreateNew: () => router.push('/procurement/quotes/scan'),
    onSelectQuote: (q: Quote) => handleSelectQuote(q),
    selectedQuoteId: selectedQuoteId ?? undefined,
  };

  const rightPane = selectedQuote ? (
    <QuoteRightPane
      quote={selectedQuote}
      pdfOpen={pdfOpen}
      commentsOpen={commentsOpen}
      onTogglePdf={handleTogglePdf}
      onToggleComments={handleToggleComments}
      onSelectQuote={handleSelectQuote}
      onRequestRenewal={handleStub}
      primaryActions={primaryActions}
      secondaryActions={secondaryActions}
      overflowActions={overflowActions}
    />
  ) : null;

  return (
    <PageContainer ariaLabel={t('nav.quotes')}>
      <div className="px-2 mt-2">
        <ProcurementSubNav className="mb-0" />
      </div>

      <ListContainer>
        <>
          {/* ── Desktop: split list + detail ───────────────────────────────── */}
          <section
            className="hidden md:flex flex-1 gap-2 min-h-0 min-w-0 overflow-hidden"
            aria-label={t('nav.quotes')}
          >
            <QuoteList {...listProps} />

            {rightPane ? (
              <div className="flex-1 flex flex-col min-h-0 overflow-y-auto bg-card border rounded-lg shadow-sm p-4">
                {rightPane}
              </div>
            ) : (
              <DetailsContainer
                emptyStateProps={{
                  icon: FileText,
                  title: tQ('detail.emptyTitle'),
                  description: tQ('detail.emptyDescription'),
                }}
                onCreateAction={() => router.push('/procurement/quotes/scan')}
              />
            )}
          </section>

          {/* ── Mobile: list (hidden when quote selected) ──────────────────── */}
          <section
            className={`md:hidden flex-1 min-h-0 overflow-hidden ${selectedQuote ? 'hidden' : 'block'}`}
            aria-label={t('nav.quotes')}
          >
            <QuoteList {...listProps} />
          </section>

          {/* ── Mobile: slide-in detail overlay ────────────────────────────── */}
          <MobileDetailsSlideIn
            isOpen={!!selectedQuote}
            onClose={() => handleSelectQuote(null)}
            title={selectedQuote?.displayNumber ?? ''}
          >
            {rightPane}
          </MobileDetailsSlideIn>
        </>
      </ListContainer>
    </PageContainer>
  );
}
