'use client';

/**
 * QuotesPageContent — Pagina /procurement/quotes (Προσφορές)
 *
 * Layout unificato pattern Contacts/POs (SSoT):
 *   PageContainer → QuotesHeader → ProcurementSubNav → UnifiedDashboard
 *   → AdvancedFiltersPanel → ListContainer (QuoteList | QuoteDetailsHeader+QuoteDetailSummary split)
 *
 * @see ADR-267 §Phase H — Quote List Panel + Detail Header SSoT
 */

import { useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { FileText, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { ModuleBreadcrumb } from '@/components/shared/ModuleBreadcrumb';
import { UnifiedDashboard } from '@/components/property-management/dashboard/UnifiedDashboard';
import {
  AdvancedFiltersPanel,
  quotesFiltersConfig,
} from '@/components/core/AdvancedFilters';
import { PageContainer, ListContainer, DetailsContainer } from '@/core/containers';
import { PageLoadingState } from '@/core/states';
import { NAVIGATION_ENTITIES } from '@/components/navigation/config';
import { MobileDetailsSlideIn } from '@/core/layouts';
import { ProcurementSubNav } from '@/subapps/procurement/components/ProcurementSubNav';
import { QuotesHeader } from '@/subapps/procurement/components/QuotesHeader';
import { QuoteList } from '@/subapps/procurement/components/QuoteList';
import { QuoteDetailSummary } from '@/subapps/procurement/components/QuoteDetailSummary';
import { QuoteDetailsHeader } from '@/subapps/procurement/components/QuoteDetailsHeader';
import { useQuotesPageState } from '@/hooks/procurement/useQuotesPageState';
import type { Quote } from '@/subapps/procurement/types/quote';

// =============================================================================
// COMPONENT
// =============================================================================

export function QuotesPageContent() {
  const router = useRouter();
  const state = useQuotesPageState();

  const {
    filteredQuotes,
    actionRequired,
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
    handleScanNew,
    t,
  } = state;

  const handleMobileClose = useCallback(() => {
    setSelectedQuote(null);
  }, [setSelectedQuote]);

  const handleEditQuote = useCallback((quoteId: string) => {
    router.push(`/procurement/quotes/${quoteId}/review`);
  }, [router]);

  if (loading && filteredQuotes.length === 0 && !showArchived) {
    return (
      <PageContainer ariaLabel={t('page.pageLabel')}>
        <PageLoadingState
          icon={FileText}
          message={t('page.loadingMessage')}
          layout="contained"
        />
      </PageContainer>
    );
  }

  return (
    <PageContainer ariaLabel={t('page.pageLabel')}>
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

      {/* ── Dashboard stats (collapsibile) ──────────────────────────────── */}
      {showDashboard && (
        <section
          role="region"
          aria-label={t('page.dashboard.label')}
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
        aria-label={t('page.filtersAria.desktop')}
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
          aria-label={t('page.filtersAria.mobile')}
        >
          <AdvancedFiltersPanel
            config={quotesFiltersConfig}
            filters={quoteFilters}
            onFiltersChange={handleFiltersChange}
            defaultOpen
          />
        </aside>
      )}

      {/* ── Sub-nav: Παραγγελίες | Προσφορές ───────────────────────────── */}
      <div className="px-2 mt-2">
        <ProcurementSubNav className="mb-0" />
      </div>

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
          <QuoteList
            quotes={filteredQuotes}
            actionRequired={actionRequired}
            loading={loading}
            onCreateNew={handleScanNew}
            onSelectQuote={handleSelectQuote}
            selectedQuoteId={selectedQuote?.id}
            onEditQuote={handleEditQuote}
          />

          {selectedQuote ? (
            <div className="flex-1 flex flex-col min-h-0 overflow-hidden bg-card border rounded-lg shadow-sm">
              <QuoteDetailsHeader
                quote={selectedQuote}
                onCreateNew={handleScanNew}
                onEdit={() => handleEditQuote(selectedQuote.id)}
                onArchive={() => archiveWithUndo(selectedQuote.id)}
              />
              <div className="flex-1 min-h-0 overflow-y-auto">
                <QuoteDetailSummary quote={selectedQuote} />
              </div>
            </div>
          ) : (
            <DetailsContainer
              selectedItem={null}
              onCreateAction={handleScanNew}
              emptyStateProps={{
                icon: NAVIGATION_ENTITIES.quote.icon,
                title: t('emptyState.title'),
                description: t('emptyState.description'),
              }}
            />
          )}
        </section>

        {/* Mobile: solo lista */}
        <section
          className={`md:hidden w-full ${selectedQuote ? 'hidden' : 'block'}`}
          role="region"
          aria-label="Quotes list mobile"
        >
          <QuoteList
            quotes={filteredQuotes}
            actionRequired={actionRequired}
            loading={loading}
            onCreateNew={handleScanNew}
            onSelectQuote={handleSelectQuote}
            selectedQuoteId={selectedQuote?.id}
            onEditQuote={handleEditQuote}
          />
        </section>

        {/* Mobile: slide-in dettaglio */}
        <MobileDetailsSlideIn
          isOpen={!!selectedQuote}
          onClose={handleMobileClose}
          title={selectedQuote?.displayNumber ?? t('detail.emptyTitle')}
        >
          {selectedQuote ? (
            <>
              <QuoteDetailsHeader
                quote={selectedQuote}
                onCreateNew={handleScanNew}
                onEdit={() => handleEditQuote(selectedQuote.id)}
                onArchive={() => archiveWithUndo(selectedQuote.id)}
              />
              <QuoteDetailSummary quote={selectedQuote} />
            </>
          ) : null}
        </MobileDetailsSlideIn>
      </ListContainer>

      {/* ── Archived view (sotto la lista principale) ────────────────────── */}
      {showArchived && (
        <section aria-label={t('quotes.archivedTab')} className="px-2 mt-4">
          <h2 className="mb-2 text-sm font-semibold text-muted-foreground">
            {t('quotes.archivedTab')}
          </h2>
          <ArchivedQuotesPanel
            quotes={archivedQuotes}
            loading={loadingArchived}
            onRestore={restoreQuote}
            emptyLabel={t('quotes.archivedEmpty')}
            restoreLabel={t('quotes.restore')}
          />
        </section>
      )}
    </PageContainer>
  );
}

export default QuotesPageContent;

// =============================================================================
// ARCHIVED PANEL — minimal restore-only list (auxiliary view)
// =============================================================================

interface ArchivedQuotesPanelProps {
  quotes: Quote[];
  loading: boolean;
  onRestore: (id: string) => void;
  emptyLabel: string;
  restoreLabel: string;
}

function ArchivedQuotesPanel({
  quotes,
  loading,
  onRestore,
  emptyLabel,
  restoreLabel,
}: ArchivedQuotesPanelProps) {
  if (loading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full rounded-md" />
        ))}
      </div>
    );
  }

  if (quotes.length === 0) {
    return <p className="text-sm text-muted-foreground py-4">{emptyLabel}</p>;
  }

  return (
    <ScrollArea className="max-h-[400px]">
      <ul className="space-y-2">
        {quotes.map((q) => (
          <li
            key={q.id}
            className="flex items-center justify-between gap-3 rounded-md border bg-card p-3"
          >
            <div className="min-w-0 flex-1">
              <p className="font-mono text-sm">{q.displayNumber}</p>
              <p className="truncate text-xs text-muted-foreground">
                {q.extractedData?.vendorName?.value ?? q.vendorContactId}
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onRestore(q.id)}
              aria-label={restoreLabel}
            >
              <RotateCcw className="mr-1 h-3.5 w-3.5" />
              {restoreLabel}
            </Button>
          </li>
        ))}
      </ul>
    </ScrollArea>
  );
}
