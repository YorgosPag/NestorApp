'use client';

/**
 * QuoteList — Quote list panel mirroring Contacts/POs SSoT pattern.
 *
 * Composition: GenericListHeader + CompactToolbar + QuoteStatusQuickFilters + ScrollArea[QuoteListCard].
 * Selected state styling and chip behavior identical to /contacts and /procurement.
 *
 * "Requires Action" quotes (submitted / under_review / expired) are pinned at
 * the top of the same scrollable list with a section divider.
 *
 * @see ADR-267 §Phase H (Quote List View)
 * @see PurchaseOrderList.tsx for sibling reference implementation
 */

import React, { useMemo, useState } from 'react';
import { FileText } from 'lucide-react';

import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';

import { GenericListHeader } from '@/components/shared/GenericListHeader';
import { CompactToolbar, quotesConfig } from '@/components/core/CompactToolbar';
import { QuoteStatusQuickFilters } from '@/components/shared/TypeQuickFilters';
import { QuoteListCard } from '@/domain';
import { EntityListColumn } from '@/core/containers';

import type { Quote, QuoteStatus } from '@/subapps/procurement/types/quote';
import { useSortState } from '@/hooks/useSortState';
import { matchesSearchTerm } from '@/lib/search/search';

import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { cn } from '@/lib/utils';

// ============================================================================
// PROPS
// ============================================================================

interface QuoteListProps {
  quotes: Quote[];
  /** Pinned action-required quotes (submitted/under_review/expired). Optional for auxiliary contexts (e.g. RFQ detail). */
  actionRequired?: Quote[];
  loading: boolean;
  /** "+Νέα Προσφορά" handler — toolbar create button. Optional; if absent, button is no-op. */
  onCreateNew?: () => void;
  /** Split-panel mode: select inline */
  onSelectQuote?: (quote: Quote) => void;
  /** Selected quote id — drives card highlight (split-panel) */
  selectedQuoteId?: string;
  /** Edit currently selected quote (split-panel: opens review page) */
  onEditQuote?: (quoteId: string) => void;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function QuoteList({
  quotes,
  actionRequired = [],
  loading,
  onCreateNew,
  onSelectQuote,
  selectedQuoteId,
  onEditQuote,
}: QuoteListProps) {
  const { t } = useTranslation(['quotes', 'common']);
  const colors = useSemanticColors();

  // Sort state via centralized hook
  const { sortBy, sortOrder, onSortChange } = useSortState<'date' | 'number' | 'status' | 'value'>('date');

  // CompactToolbar local state (mirrors PurchaseOrderList)
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilters, setActiveFilters] = useState<string[]>([]);
  const [showToolbar, setShowToolbar] = useState(false);

  // Quick-filter chips state — single-select mirroring POStatusQuickFilters
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);

  // Filter pipeline: status chips → search (displayNumber + vendorContactId + trade) → sort.
  // Vendor-name resolution (extractedData/contact) happens per-card; batch directory hook
  // would be a separate optimization.
  const filtered = useMemo(() => {
    const actionRequiredIds = new Set(actionRequired.map((q) => q.id));

    return quotes.filter((q) => {
      if (selectedStatuses.length > 0 && !selectedStatuses.includes(q.status as QuoteStatus)) {
        return false;
      }
      if (searchTerm) {
        const extractedVendor = q.extractedData?.vendorName?.value ?? '';
        return matchesSearchTerm(
          [q.displayNumber, q.vendorContactId, q.trade, extractedVendor, q.id],
          searchTerm,
        );
      }
      return true;
    }).map((q) => ({ q, isActionRequired: actionRequiredIds.has(q.id) }));
  }, [quotes, actionRequired, selectedStatuses, searchTerm]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    arr.sort((a, b) => {
      // Pinned action-required items always first (regardless of sort direction)
      if (a.isActionRequired !== b.isActionRequired) {
        return a.isActionRequired ? -1 : 1;
      }
      const dir = sortOrder === 'asc' ? 1 : -1;
      switch (sortBy) {
        case 'number':
          return a.q.displayNumber.localeCompare(b.q.displayNumber) * dir;
        case 'status':
          return a.q.status.localeCompare(b.q.status) * dir;
        case 'value':
          return (a.q.totals.total - b.q.totals.total) * dir;
        case 'date':
        default: {
          const aTs = (a.q.createdAt as { seconds: number } | null)?.seconds ?? 0;
          const bTs = (b.q.createdAt as { seconds: number } | null)?.seconds ?? 0;
          return (aTs - bTs) * dir;
        }
      }
    });
    return arr;
  }, [filtered, sortBy, sortOrder]);

  const firstNonAction = sorted.findIndex((entry) => !entry.isActionRequired);
  const actionRequiredVisible = sorted.filter((e) => e.isActionRequired).length;

  // Action handlers — wire toolbar to parent callbacks; mirror PurchaseOrderList semantics
  const handleNewItem = () => onCreateNew?.();
  const handleEditItem = (_id: string) => {
    if (selectedQuoteId && onEditQuote) onEditQuote(selectedQuoteId);
  };

  const renderSortChange = (newSortBy: string, newSortOrder: 'asc' | 'desc') => {
    if (newSortBy === 'date' || newSortBy === 'number' || newSortBy === 'status' || newSortBy === 'value') {
      onSortChange(newSortBy, newSortOrder);
    }
  };

  return (
    <EntityListColumn hasBorder aria-label={t('list.ariaLabel')}>
      {/* Header + CompactToolbar */}
      <div>
        <GenericListHeader
          icon={FileText}
          entityName={t('list.entityName')}
          itemCount={sorted.length}
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          searchPlaceholder={t('list.searchPlaceholder')}
          showToolbar={showToolbar}
          onToolbarToggle={setShowToolbar}
          hideSearch
        />

        {/* Desktop: always visible */}
        <div className="hidden md:block">
          <CompactToolbar
            config={quotesConfig}
            selectedItems={selectedItems}
            onSelectionChange={setSelectedItems}
            searchTerm={searchTerm}
            onSearchChange={setSearchTerm}
            activeFilters={activeFilters}
            onFiltersChange={setActiveFilters}
            sortBy={sortBy}
            onSortChange={renderSortChange}
            hasSelectedContact={!!selectedQuoteId}
            onNewItem={handleNewItem}
            onEditItem={handleEditItem}
          />
        </div>

        {/* Mobile: toggle */}
        <div className="md:hidden">
          {showToolbar && (
            <CompactToolbar
              config={quotesConfig}
              selectedItems={selectedItems}
              onSelectionChange={setSelectedItems}
              searchTerm={searchTerm}
              onSearchChange={setSearchTerm}
              activeFilters={activeFilters}
              onFiltersChange={setActiveFilters}
              sortBy={sortBy}
              onSortChange={renderSortChange}
              hasSelectedContact={!!selectedQuoteId}
              onNewItem={handleNewItem}
              onEditItem={handleEditItem}
            />
          )}
        </div>
      </div>

      {/* Quick-filter chips — Quote status */}
      <QuoteStatusQuickFilters
        selectedTypes={selectedStatuses}
        onTypeChange={setSelectedStatuses}
        compact
      />

      {/* List */}
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-2">
          {loading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="p-3 rounded-lg border border-border bg-card">
                <Skeleton className="h-4 w-3/4 mb-2" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            ))
          ) : sorted.length === 0 ? (
            <div className={cn('text-center p-4', colors.text.muted)}>
              <p>{t('list.emptyTitle')}</p>
              <p className="text-sm mt-1">{t('list.emptyDescription')}</p>
            </div>
          ) : (
            sorted.map((entry, index) => (
              <React.Fragment key={entry.q.id}>
                {/* Section divider between Requires Action block and the rest */}
                {actionRequiredVisible > 0 && index === 0 && (
                  <div className="flex items-center gap-2 px-1 pt-1 pb-2">
                    <span className={cn('text-xs font-medium uppercase tracking-wide', colors.text.muted)}>
                      {t('list.requiresAction')}
                    </span>
                    <Badge variant="secondary" className="text-xs">{actionRequiredVisible}</Badge>
                  </div>
                )}
                {actionRequiredVisible > 0 && index === firstNonAction && (
                  <div className="flex items-center gap-2 px-1 pt-3 pb-2">
                    <span className={cn('text-xs font-medium uppercase tracking-wide', colors.text.muted)}>
                      {t('list.allQuotes')}
                    </span>
                  </div>
                )}
                <QuoteListCard
                  quote={entry.q}
                  isSelected={selectedQuoteId === entry.q.id}
                  onSelect={() => onSelectQuote?.(entry.q)}
                />
              </React.Fragment>
            ))
          )}
        </div>
      </ScrollArea>
    </EntityListColumn>
  );
}
