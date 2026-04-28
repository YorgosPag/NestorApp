'use client';

/**
 * QuotesPageContent — Lista quote AI-scansionate con soft-delete + undo toast
 *
 * Layout: PageContainer → ProcurementSubNav → QuoteList
 * Archive pattern: Gmail undo (5s timeout, ottimistico)
 * Archived view: toggle "Αρχειοθετημένες (N)" + restore
 *
 * @see ADR-327 §6 — AI Scan pipeline
 */

import { ScanLine, FileText, ArchiveX, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageContainer } from '@/core/containers';
import { PageLoadingState } from '@/core/states';
import { ModuleBreadcrumb } from '@/components/shared/ModuleBreadcrumb';
import { ProcurementSubNav } from '@/subapps/procurement/components/ProcurementSubNav';
import { QuoteList } from '@/subapps/procurement/components/QuoteList';
import { useQuotesPageState } from '@/hooks/procurement/useQuotesPageState';

export function QuotesPageContent() {
  const {
    displayedQuotes,
    loading,
    error,
    archiveWithUndo,
    handleViewQuote,
    handleScanNew,
    showArchived,
    archivedQuotes,
    loadingArchived,
    toggleArchived,
    restoreQuote,
    isNamespaceReady,
    t,
  } = useQuotesPageState();

  if (!isNamespaceReady) {
    return (
      <PageContainer ariaLabel="">
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </PageContainer>
    );
  }

  if (loading && displayedQuotes.length === 0 && !showArchived) {
    return (
      <PageContainer ariaLabel={t('quotes.title')}>
        <PageLoadingState
          icon={FileText}
          message={t('quotes.loading')}
          layout="contained"
        />
      </PageContainer>
    );
  }

  const archivedLabel = archivedQuotes.length > 0
    ? t('quotes.archivedCount', { count: archivedQuotes.length })
    : t('quotes.archivedTab');

  return (
    <PageContainer ariaLabel={t('quotes.title')}>
      {/* ── Breadcrumb + Sub-nav ─────────────────────────────────────────── */}
      <div className="flex flex-col gap-1">
        <ModuleBreadcrumb />
        <ProcurementSubNav />
      </div>

      {/* ── Header actions ──────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">{t('quotes.title')}</h1>
          <p className="text-sm text-muted-foreground">{t('quotes.list')}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => void toggleArchived()}>
            <ArchiveX className="mr-1.5 h-4 w-4" />
            {archivedLabel}
          </Button>
          <Button onClick={handleScanNew}>
            <ScanLine className="mr-1.5 h-4 w-4" />
            {t('quotes.create')}
          </Button>
        </div>
      </div>

      {/* ── Error ────────────────────────────────────────────────────────── */}
      {error && (
        <p className="rounded-md border border-destructive/50 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error}
        </p>
      )}

      {/* ── Active quote list ────────────────────────────────────────────── */}
      <QuoteList
        quotes={displayedQuotes}
        loading={loading}
        onView={handleViewQuote}
        onArchive={archiveWithUndo}
      />

      {/* ── Archived quote list ──────────────────────────────────────────── */}
      {showArchived && (
        <section aria-label={t('quotes.archivedTab')}>
          <h2 className="mb-2 text-sm font-semibold text-muted-foreground">
            {t('quotes.archivedTab')}
          </h2>
          <QuoteList
            quotes={archivedQuotes}
            loading={loadingArchived}
            onRestore={restoreQuote}
            emptyMessage={t('quotes.archivedEmpty')}
          />
        </section>
      )}
    </PageContainer>
  );
}
