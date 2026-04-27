'use client';

/**
 * QuotesPageContent — Lista quote AI-scansionate con soft-delete + undo toast
 *
 * Layout: PageContainer → ProcurementSubNav → QuoteList
 * Archive pattern: Gmail undo (5s timeout, ottimistico)
 *
 * @see ADR-327 §6 — AI Scan pipeline
 */

import { ScanLine, FileText } from 'lucide-react';
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
    t,
  } = useQuotesPageState();

  if (loading && displayedQuotes.length === 0) {
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
        <Button onClick={handleScanNew}>
          <ScanLine className="mr-1.5 h-4 w-4" />
          {t('quotes.create')}
        </Button>
      </div>

      {/* ── Error ────────────────────────────────────────────────────────── */}
      {error && (
        <p className="rounded-md border border-destructive/50 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error}
        </p>
      )}

      {/* ── Quote list ───────────────────────────────────────────────────── */}
      <QuoteList
        quotes={displayedQuotes}
        loading={loading}
        onView={handleViewQuote}
        onArchive={archiveWithUndo}
        onCreateNew={handleScanNew}
      />
    </PageContainer>
  );
}
