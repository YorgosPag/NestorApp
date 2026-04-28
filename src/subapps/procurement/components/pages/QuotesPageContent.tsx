'use client';

/**
 * QuotesPageContent — Pagina /procurement/quotes (Προσφορές)
 *
 * Layout unificato pattern Contacts/POs (SSoT):
 *   PageContainer → QuotesHeader → ProcurementSubNav → UnifiedDashboard
 *   → AdvancedFiltersPanel → ListContainer (QuoteList | QuoteDetailSummary split)
 *
 * @see ADR-327 §Layout Unification
 */

import { useCallback } from 'react';
import { FileText, Loader2 } from 'lucide-react';
import { ModuleBreadcrumb } from '@/components/shared/ModuleBreadcrumb';
import { UnifiedDashboard } from '@/components/property-management/dashboard/UnifiedDashboard';
import {
  AdvancedFiltersPanel,
  quotesFiltersConfig,
} from '@/components/core/AdvancedFilters';
import { PageContainer, ListContainer } from '@/core/containers';
import { PageLoadingState } from '@/core/states';
import { MobileDetailsSlideIn } from '@/core/layouts';
import { ProcurementSubNav } from '@/subapps/procurement/components/ProcurementSubNav';
import { QuotesHeader } from '@/subapps/procurement/components/QuotesHeader';
import { QuoteList } from '@/subapps/procurement/components/QuoteList';
import { QuoteDetailSummary } from '@/subapps/procurement/components/QuoteDetailSummary';
import { useQuotesPageState } from '@/hooks/procurement/useQuotesPageState';

// =============================================================================
// COMPONENT
// =============================================================================

export function QuotesPageContent() {
  const state = useQuotesPageState();

  const {
    filteredQuotes,
    loading,
    error,
    selectedQuote,
    setSelectedQuote,
    handleSelectQuote,
    showDashboard,
    setShowDashboard,
    showFilters,
    setShowFilters,
    quoteFilters,
    handleFiltersChange,
    dashboardStats,
    handleCardClick,
    archiveWithUndo,
    showArchived,
    archivedQuotes,
    loadingArchived,
    toggleArchived,
    restoreQuote,
    handleViewQuote,
    handleScanNew,
    isNamespaceReady,
    t,
  } = state;

  const handleMobileClose = useCallback(() => {
    setSelectedQuote(null);
  }, [setSelectedQuote]);

  if (!isNamespaceReady) {
    return (
      <PageContainer ariaLabel="">
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </PageContainer>
    );
  }

  if (loading && filteredQuotes.length === 0 && !showArchived) {
    return (
      <PageContainer ariaLabel={t('quotes.page.pageLabel')}>
        <PageLoadingState
          icon={FileText}
          message={t('quotes.page.loadingMessage')}
          layout="contained"
        />
      </PageContainer>
    );
  }

  return (
    <PageContainer ariaLabel={t('quotes.page.pageLabel')}>
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <QuotesHeader
        showDashboard={showDashboard}
        setShowDashboard={setShowDashboard}
        showFilters={showFilters}
        setShowFilters={setShowFilters}
        archivedCount={archivedQuotes.length}
        showArchived={showArchived}
        onToggleArchived={() => void toggleArchived()}
        onScanNew={handleScanNew}
        breadcrumb={<ModuleBreadcrumb />}
      />

      {/* ── Sub-nav: Παραγγελίες | Προσφορές ───────────────────────────── */}
      <ProcurementSubNav />

      {/* ── Dashboard stats (collapsibile) ──────────────────────────────── */}
      {showDashboard && (
        <section
          role="region"
          aria-label={t('quotes.page.dashboard.label')}
          className="w-full overflow-hidden"
        >
          <UnifiedDashboard
            stats={dashboardStats}
            columns={4}
            onCardClick={handleCardClick}
            className="px-1 py-4 sm:px-4 sm:py-4 border-b bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950/20 dark:to-purple-950/20 overflow-hidden"
          />
        </section>
      )}

      {/* ── Advanced Filters — Desktop ───────────────────────────────────── */}
      <aside
        className="hidden md:block"
        role="complementary"
        aria-label={t('quotes.page.filters.desktop')}
      >
        <AdvancedFiltersPanel
          config={quotesFiltersConfig}
          filters={quoteFilters}
          onFiltersChange={handleFiltersChange}
        />
      </aside>

      {/* ── Advanced Filters — Mobile (condizionale) ─────────────────────── */}
      {showFilters && (
        <aside
          className="md:hidden"
          role="complementary"
          aria-label={t('quotes.page.filters.mobile')}
        >
          <AdvancedFiltersPanel
            config={quotesFiltersConfig}
            filters={quoteFilters}
            onFiltersChange={handleFiltersChange}
            defaultOpen
          />
        </aside>
      )}

      {/* ── Error ────────────────────────────────────────────────────────── */}
      {error && (
        <p
          role="alert"
          className="rounded-md border border-destructive/50 bg-destructive/5 px-4 py-3 text-sm text-destructive mx-2"
        >
          {error}
        </p>
      )}

      {/* ── List + Detail split ──────────────────────────────────────────── */}
      <ListContainer>
        {/* Desktop: lista sx | dettaglio dx */}
        <section
          className="hidden md:flex flex-1 gap-2 min-h-0 min-w-0 overflow-hidden"
          role="region"
          aria-label="Quotes list and detail"
        >
          <div className="flex-1 min-h-0 overflow-y-auto">
            <QuoteList
              quotes={filteredQuotes}
              loading={loading}
              onView={handleViewQuote}
              onArchive={archiveWithUndo}
            />
          </div>

          <div className="flex-1 flex flex-col min-h-0 overflow-hidden bg-card border rounded-lg shadow-sm">
            {selectedQuote ? (
              <QuoteDetailSummary
                quote={selectedQuote}
                onArchive={archiveWithUndo}
              />
            ) : (
              <EmptyDetailState
                label={t('quotes.detail.emptyTitle')}
                description={t('quotes.detail.emptyDescription')}
              />
            )}
          </div>
        </section>

        {/* Mobile: solo lista */}
        <section
          className={`md:hidden w-full ${selectedQuote ? 'hidden' : 'block'}`}
          role="region"
          aria-label="Quotes list mobile"
        >
          <QuoteList
            quotes={filteredQuotes}
            loading={loading}
            onView={handleViewQuote}
            onArchive={archiveWithUndo}
          />
        </section>

        {/* Mobile: slide-in dettaglio */}
        <MobileDetailsSlideIn
          isOpen={!!selectedQuote}
          onClose={handleMobileClose}
          title={selectedQuote?.displayNumber ?? t('quotes.detail.emptyTitle')}
        >
          {selectedQuote ? (
            <QuoteDetailSummary
              quote={selectedQuote}
              onArchive={archiveWithUndo}
            />
          ) : null}
        </MobileDetailsSlideIn>
      </ListContainer>

      {/* ── Archived view (sotto la lista principale) ────────────────────── */}
      {showArchived && (
        <section aria-label={t('quotes.archivedTab')} className="px-2 mt-4">
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

export default QuotesPageContent;

// =============================================================================
// EMPTY STATE
// =============================================================================

function EmptyDetailState({
  label,
  description,
}: {
  label: string;
  description: string;
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
        <FileText className="h-8 w-8 text-muted-foreground" />
      </div>
      <div className="space-y-1">
        <p className="font-semibold text-foreground">{label}</p>
        <p className="text-sm text-muted-foreground max-w-xs">{description}</p>
      </div>
    </div>
  );
}
