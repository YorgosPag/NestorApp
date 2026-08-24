'use client';

import { useCallback, useMemo, useState } from 'react';
import { useRouter, usePathname } from '@/lib/workspace/navigation';
import { declaredHref } from '@/lib/workspace/route-worlds';
import { useSearchParams } from 'next/navigation';
import { FileText, Inbox, Eye, CheckCircle, Clock } from 'lucide-react';
import { QuoteList } from '@/subapps/procurement/components/QuoteList';
import { QuoteRightPane } from '@/subapps/procurement/components/QuoteRightPane';
import { useQuotes } from '@/subapps/procurement/hooks/useQuotes';
import { usePatchQuoteStatus } from '@/subapps/procurement/hooks/usePatchQuoteStatus';
import { buildQuoteHeaderActions } from '@/subapps/procurement/utils/quote-header-actions';
import { ProcurementHubPage, useProcurementHubChrome } from '@/components/procurement/hub/ProcurementHubPage';
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
      router.replace(
        declaredHref('usePathname() είναι ΗΔΗ η έγκυρη τρέχουσα σελίδα — ενημέρωση ερωτήματος, όχι νέος προορισμός.', `${pathname}?${params.toString()}`),
      );
    },
    [router, searchParams, pathname],
  );

  // ── Local UI state ────────────────────────────────────────────────────────
  const [pdfOpen, setPdfOpen] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const chrome = useProcurementHubChrome();
  const { viewMode } = chrome;

  const dashboardStats = useMemo(() => {
    const total = quotes.length;
    const submitted = quotes.filter((q) => q.status === 'submitted').length;
    const underReview = quotes.filter((q) => q.status === 'under_review').length;
    const accepted = quotes.filter((q) => q.status === 'accepted').length;
    const expired = quotes.filter((q) => q.status === 'expired').length;
    return [
      { title: tQ('list.entityName'), value: total, icon: FileText, color: 'blue' as const },
      { title: tQ('filters.quoteStatus.submitted'), value: submitted, icon: Inbox, color: 'green' as const },
      { title: tQ('filters.quoteStatus.under_review'), value: underReview, icon: Eye, color: 'orange' as const },
      { title: tQ('filters.quoteStatus.accepted'), value: accepted, icon: CheckCircle, color: 'purple' as const },
      { title: tQ('filters.quoteStatus.expired'), value: expired, icon: Clock, color: 'red' as const },
    ];
  }, [quotes, tQ]);

  const handleTogglePdf = useCallback(() => setPdfOpen((v) => !v), []);
  const handleToggleComments = useCallback(() => setCommentsOpen((v) => !v), []);

  // ── Quote mutations ───────────────────────────────────────────────────────
  const patchQuoteStatus = usePatchQuoteStatus(selectedQuote, tQ);

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
    viewMode,
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
      onCreateNew={() => router.push('/procurement/quotes/scan')}
    />
  ) : null;

  return (
    <ProcurementHubPage
      icon={FileText}
      title={t('nav.quotes')}
      subtitle={t('hub.quotes.description')}
      dashboardColumns={5}
      chrome={chrome}
      dashboardStats={dashboardStats}
      list={<QuoteList {...listProps} />}
      detail={rightPane}
      emptyState={{
        icon: FileText,
        title: tQ('detail.emptyTitle'),
        description: tQ('detail.emptyDescription'),
      }}
      onCreateAction={() => router.push('/procurement/quotes/scan')}
      detailOpen={!!selectedQuote}
      detailTitle={selectedQuote?.displayNumber ?? ''}
      onDetailClose={() => handleSelectQuote(null)}
    />
  );
}
