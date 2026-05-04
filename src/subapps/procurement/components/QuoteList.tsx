'use client';

/**
 * QuoteList — Quote list panel mirroring Contacts/POs SSoT pattern.
 *
 * Composition: GenericListHeader + CompactToolbar + SortSelect + QuoteStatusQuickFilters + ScrollArea[QuoteListCard].
 * In RFQ split-panel mode (onSelectQuote provided): URL-persistent sort (?sort=) + search (?q=)
 * + status-priority group dividers. In standalone mode: legacy CompactToolbar sort.
 *
 * @see ADR-328 §5.P §5.U §5.W (Phase 7 — Sort + Search)
 * @see ADR-267 §Phase H (Quote List View)
 */

import React, { useMemo, useState, useCallback } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { FileText, History, Loader2, Search, XCircle } from 'lucide-react';

import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

import { GenericListHeader } from '@/components/shared/GenericListHeader';
import { CompactToolbar, quotesConfig } from '@/components/core/CompactToolbar';
import { QuoteStatusQuickFilters } from '@/components/shared/TypeQuickFilters';
import { QuoteListCard, QuoteGridCard } from '@/domain';
import { EntityListColumn } from '@/core/containers';

import type { Quote, QuoteStatus } from '@/subapps/procurement/types/quote';
import type { ScanQueueItem } from '../hooks/useScanQueue';
import { useSortState } from '@/hooks/useSortState';
import { matchesSearchTerm } from '@/lib/search/search';
import {
  sortQuotes,
  groupByStatus,
  type SortKey,
  VALID_SORT_KEYS,
  DEFAULT_SORT_KEY,
} from '../utils/quote-sort';
import { matchesQuote } from '../utils/quote-search';

import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { cn } from '@/lib/utils';

interface QuoteListProps {
  quotes: Quote[];
  /** Pinned action-required quotes (submitted/under_review/expired). Optional for auxiliary contexts (e.g. RFQ detail). */
  actionRequired?: Quote[];
  loading: boolean;
  /** "+Νέα Προσφορά" handler — toolbar create button. Optional; if absent, button is no-op. */
  onCreateNew?: () => void;
  /** Split-panel mode: select inline. Presence enables RFQ mode (URL sort+search). */
  onSelectQuote?: (quote: Quote) => void;
  /** Selected quote id — drives card highlight (split-panel) */
  selectedQuoteId?: string;
  /** Edit currently selected quote (split-panel: opens review page) */
  onEditQuote?: (quoteId: string) => void;
  /** Async scan placeholders (§5.H). Only rendered in RFQ mode. */
  scanItems?: ScanQueueItem[];
  onRetryScan?: (clientId: string) => void;
  onRemoveScan?: (clientId: string) => void;
  /** View mode — 'list' (default) renders QuoteListCard, 'grid' renders QuoteGridCard tiles */
  viewMode?: 'list' | 'grid';
}

function ScanPlaceholderRow({
  item,
  onRetry,
  onRemove,
}: {
  item: ScanQueueItem;
  onRetry: () => void;
  onRemove: () => void;
}) {
  const { t } = useTranslation(['quotes', 'common']);
  const stageKeys = ['reading', 'extracting', 'validating'] as const;
  const stageLabel = item.stage
    ? t(`rfqs.scan.stage.${stageKeys[item.stage - 1]}`)
    : t('rfqs.scan.stage.processing');

  if (item.status === 'error') {
    return (
      <div className="flex items-center gap-2 px-3 py-2 rounded border border-destructive/50 bg-destructive/5 text-destructive text-xs">
        <XCircle className="size-3 shrink-0" />
        <span className="flex-1 truncate font-medium">{item.fileName}</span>
        <span className="text-destructive/80">{t('rfqs.scan.placeholder.failed')}</span>
        <button type="button" onClick={onRetry} className="underline hover:no-underline shrink-0">
          {t('rfqs.scan.placeholder.retry')}
        </button>
        <button type="button" onClick={onRemove} className="underline hover:no-underline shrink-0">
          {t('rfqs.scan.placeholder.delete')}
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded border border-dashed border-primary/30 bg-primary/5 text-xs">
      <Loader2 className="size-3 shrink-0 animate-spin text-primary" />
      <span className="flex-1 truncate font-medium">{item.fileName}</span>
      <span className="text-muted-foreground">{stageLabel}</span>
    </div>
  );
}

function SupersededVersionRow({ quote }: { quote: Quote }) {
  const dateStr = (() => {
    const ts = (quote.submittedAt ?? quote.createdAt) as { seconds: number } | null;
    return ts?.seconds ? new Date(ts.seconds * 1000).toLocaleDateString('el-GR') : '—';
  })();
  return (
    <div className="ml-4 flex items-center gap-2 px-3 py-1.5 rounded border border-dashed border-muted text-muted-foreground text-xs opacity-70">
      <History className="size-3 shrink-0" />
      <span className="font-mono">v{quote.version ?? 1}</span>
      <span className="flex-1 truncate">{formatCurrencyRow(quote.totals.total)}</span>
      <span>{dateStr}</span>
    </div>
  );
}

function formatCurrencyRow(n: number): string {
  return new Intl.NumberFormat('el-GR', { style: 'currency', currency: 'EUR' }).format(n);
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
  scanItems = [],
  onRetryScan,
  onRemoveScan,
  viewMode = 'list',
}: QuoteListProps) {
  const { t } = useTranslation(['quotes', 'common']);
  const colors = useSemanticColors();
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  // RFQ mode: URL-persistent sort + search (activated when onSelectQuote is provided)
  const isRfqMode = !!onSelectQuote;

  const sortParam = searchParams.get('sort');
  const urlSearch = searchParams.get('q') ?? '';
  const sortKey: SortKey =
    isRfqMode && (VALID_SORT_KEYS as readonly string[]).includes(sortParam ?? '')
      ? (sortParam as SortKey)
      : DEFAULT_SORT_KEY;
  const handleUrlSortChange = useCallback(
    (newSort: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (newSort === DEFAULT_SORT_KEY) params.delete('sort');
      else params.set('sort', newSort);
      router.replace(`${pathname}?${params.toString()}`);
    },
    [router, pathname, searchParams],
  );
  const handleUrlSearchChange = useCallback(
    (value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value) params.set('q', value);
      else params.delete('q');
      router.replace(`${pathname}?${params.toString()}`);
    },
    [router, pathname, searchParams],
  );
  // Legacy state (standalone mode + CompactToolbar)
  const { sortBy, sortOrder, onSortChange } = useSortState<'date' | 'number' | 'status' | 'value'>('date');
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilters, setActiveFilters] = useState<string[]>([]);
  const [showToolbar, setShowToolbar] = useState(false);
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);

  // ──────────────────────────────────────────────────────────────
  // ──────────────────────────────────────────────────────────────
  // Versioning: active vs superseded segregation (§5.AA.6 / §5.AA.7)
  // ──────────────────────────────────────────────────────────────
  const [expandedVersions, setExpandedVersions] = useState<Set<string>>(new Set());

  const toggleVersionExpand = useCallback((quoteId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedVersions((prev) => {
      const next = new Set(prev);
      if (next.has(quoteId)) next.delete(quoteId);
      else next.add(quoteId);
      return next;
    });
  }, []);
  const supersededByParentId = useMemo<Map<string, Quote[]>>(() => {
    if (!isRfqMode) return new Map();
    const map = new Map<string, Quote[]>();
    for (const q of quotes) {
      if (q.status === 'superseded' && q.supersededBy) {
        const arr = map.get(q.supersededBy) ?? [];
        arr.push(q);
        map.set(q.supersededBy, arr);
      }
    }
    return map;
  }, [isRfqMode, quotes]);
  // ──────────────────────────────────────────────────────────────
  // RFQ mode: filter active → sort → group
  // ──────────────────────────────────────────────────────────────
  const rfqSorted = useMemo<Quote[]>(() => {
    if (!isRfqMode) return [];
    const filtered = quotes.filter((q) => {
      if (q.status === 'superseded') return false;
      if (selectedStatuses.length > 0 && !selectedStatuses.includes(q.status as QuoteStatus)) return false;
      return matchesQuote(q, urlSearch);
    });
    return sortQuotes(filtered, sortKey);
  }, [isRfqMode, quotes, selectedStatuses, urlSearch, sortKey]);
  const rfqGroups = useMemo(
    () => (isRfqMode && sortKey === 'status-price' ? groupByStatus(rfqSorted) : null),
    [isRfqMode, sortKey, rfqSorted],
  );
  // ──────────────────────────────────────────────────────────────
  // Standalone mode: filter → sort (legacy behaviour)
  // ──────────────────────────────────────────────────────────────
  const standaloneSorted = useMemo<{ q: Quote; isActionRequired: boolean }[]>(() => {
    if (isRfqMode) return [];
    const actionRequiredIds = new Set(actionRequired.map((q) => q.id));
    const filtered = quotes
      .filter((q) => {
        if (selectedStatuses.length > 0 && !selectedStatuses.includes(q.status as QuoteStatus)) return false;
        if (searchTerm) {
          const extractedVendor = q.extractedData?.vendorName?.value ?? '';
          return matchesSearchTerm([q.displayNumber, q.vendorContactId, q.trade, extractedVendor, q.id], searchTerm);
        }
        return true;
      })
      .map((q) => ({ q, isActionRequired: actionRequiredIds.has(q.id) }));

    const dir = sortOrder === 'asc' ? 1 : -1;
    return [...filtered].sort((a, b) => {
      if (a.isActionRequired !== b.isActionRequired) return a.isActionRequired ? -1 : 1;
      switch (sortBy) {
        case 'number': return a.q.displayNumber.localeCompare(b.q.displayNumber) * dir;
        case 'status': return a.q.status.localeCompare(b.q.status) * dir;
        case 'value': return (a.q.totals.total - b.q.totals.total) * dir;
        case 'date':
        default: {
          const aTs = (a.q.createdAt as { seconds: number } | null)?.seconds ?? 0;
          const bTs = (b.q.createdAt as { seconds: number } | null)?.seconds ?? 0;
          return (aTs - bTs) * dir;
        }
      }
    });
  }, [isRfqMode, quotes, actionRequired, selectedStatuses, searchTerm, sortBy, sortOrder]);

  const displayCount = isRfqMode ? rfqSorted.length : standaloneSorted.length;
  const effectiveSearch = isRfqMode ? urlSearch : searchTerm;
  const handleSearchChange = isRfqMode ? handleUrlSearchChange : setSearchTerm;
  const firstNonAction = isRfqMode ? -1 : standaloneSorted.findIndex((e) => !e.isActionRequired);
  const actionRequiredVisible = isRfqMode ? 0 : standaloneSorted.filter((e) => e.isActionRequired).length;
  const handleStandaloneSelect = useCallback(
    (q: Quote) => { if (onSelectQuote) onSelectQuote(q); },
    [onSelectQuote],
  );

  const renderSortChange = (newSortBy: string, newSortOrder: 'asc' | 'desc') => {
    if (newSortBy === 'date' || newSortBy === 'number' || newSortBy === 'status' || newSortBy === 'value') {
      onSortChange(newSortBy, newSortOrder);
    }
  };
  const handleNewItem = () => onCreateNew?.();
  const handleEditItem = () => { if (selectedQuoteId && onEditQuote) onEditQuote(selectedQuoteId); };
  return (
    <EntityListColumn hasBorder aria-label={t('list.ariaLabel')}>
      {/* Header + CompactToolbar */}
      <div>
        <GenericListHeader
          icon={FileText}
          entityName={t('list.entityName')}
          itemCount={displayCount}
          searchTerm={effectiveSearch}
          onSearchChange={handleSearchChange}
          searchPlaceholder={t('list.searchPlaceholder')}
          showToolbar={showToolbar}
          onToolbarToggle={setShowToolbar}
          hideSearch
        />
        <div className="hidden md:block">
          <CompactToolbar
            config={quotesConfig}
            selectedItems={selectedItems}
            onSelectionChange={setSelectedItems}
            searchTerm={effectiveSearch}
            onSearchChange={handleSearchChange}
            activeFilters={activeFilters}
            onFiltersChange={setActiveFilters}
            sortBy={sortBy}
            onSortChange={renderSortChange}
            hasSelectedContact={!!selectedQuoteId}
            onNewItem={handleNewItem}
            onEditItem={handleEditItem}
          />
        </div>
        <div className="md:hidden">
          {showToolbar && (
            <CompactToolbar
              config={quotesConfig}
              selectedItems={selectedItems}
              onSelectionChange={setSelectedItems}
              searchTerm={effectiveSearch}
              onSearchChange={handleSearchChange}
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

      {/* Sort dropdown — RFQ mode only (ADR-328 §5.P) */}
      {isRfqMode && (
        <div className="flex items-center gap-2 px-3 pb-2">
          <span className={cn('text-xs shrink-0', colors.text.muted)}>{t('rfqs.sort.label')}</span>
          <Select value={sortKey} onValueChange={handleUrlSortChange}>
            <SelectTrigger className="h-7 text-xs flex-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="status-price">{t('rfqs.sort.option.statusPriceDefault')}</SelectItem>
              <SelectItem value="recent">{t('rfqs.sort.option.recent')}</SelectItem>
              <SelectItem value="price-asc">{t('rfqs.sort.option.priceAsc')}</SelectItem>
              <SelectItem value="price-desc">{t('rfqs.sort.option.priceDesc')}</SelectItem>
              <SelectItem value="vendor-asc">{t('rfqs.sort.option.vendorAsc')}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Quick-filter chips — Quote status */}
      <QuoteStatusQuickFilters
        selectedTypes={selectedStatuses}
        onTypeChange={setSelectedStatuses}
        compact
      />

      {/* Scan placeholders — top of list in RFQ mode (§5.H.1) */}
      {isRfqMode && scanItems.length > 0 && (
        <div className="px-2 pt-2 space-y-1.5">
          {scanItems.map((item) => (
            <ScanPlaceholderRow
              key={item.clientId}
              item={item}
              onRetry={() => onRetryScan?.(item.clientId)}
              onRemove={() => onRemoveScan?.(item.clientId)}
            />
          ))}
        </div>
      )}

      {/* List */}
      <ScrollArea className="flex-1">
        {viewMode === 'grid' && !loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 p-3">
            {(isRfqMode ? rfqSorted : standaloneSorted.map((e) => e.q)).map((q) => (
              <QuoteGridCard
                key={q.id}
                quote={q}
                isSelected={selectedQuoteId === q.id}
                onSelect={() => onSelectQuote?.(q)}
              />
            ))}
          </div>
        ) : (
        <div className="p-2 space-y-2">
          {loading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="p-3 rounded-lg border border-border bg-card">
                <Skeleton className="h-4 w-3/4 mb-2" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            ))
          ) : isRfqMode ? (
            rfqSorted.length === 0 ? (
              urlSearch ? (
                <div className={cn('text-center p-6 space-y-3', colors.text.muted)}>
                  <Search className="mx-auto h-8 w-8 opacity-40" />
                  <p className="text-sm font-medium">
                    {t('rfqs.search.empty.title', { query: urlSearch })}
                  </p>
                  <div className="text-xs text-left space-y-1">
                    <p>{t('rfqs.search.empty.suggestionsTitle')}</p>
                    <ul className="list-disc list-inside space-y-0.5 opacity-80">
                      <li>{t('rfqs.search.empty.suggestion.vendor')}</li>
                      <li>{t('rfqs.search.empty.suggestion.quoteNumber')}</li>
                      <li>{t('rfqs.search.empty.suggestion.price')}</li>
                    </ul>
                  </div>
                </div>
              ) : (
                <div className={cn('text-center p-4', colors.text.muted)}>
                  <p>{t('list.emptyTitle')}</p>
                  <p className="text-sm mt-1">{t('list.emptyDescription')}</p>
                </div>
              )
            ) : rfqGroups ? (
              rfqGroups.map((group, groupIdx) => (
                <React.Fragment key={group.status}>
                  {groupIdx > 0 && <div className="border-t border-muted my-2" />}
                  {group.quotes.map((q) => {
                    const older = supersededByParentId.get(q.id) ?? [];
                    const isExpanded = expandedVersions.has(q.id);
                    return (
                      <React.Fragment key={q.id}>
                        <QuoteListCard
                          quote={q}
                          isSelected={selectedQuoteId === q.id}
                          onSelect={() => onSelectQuote(q)}
                          hasOlderVersions={older.length > 0}
                          isVersionExpanded={isExpanded}
                          onVersionToggle={(e) => toggleVersionExpand(q.id, e)}
                        />
                        {isExpanded && older.map((sq) => (
                          <SupersededVersionRow key={sq.id} quote={sq} />
                        ))}
                      </React.Fragment>
                    );
                  })}
                </React.Fragment>
              ))
            ) : (
              rfqSorted.map((q) => {
                const older = supersededByParentId.get(q.id) ?? [];
                const isExpanded = expandedVersions.has(q.id);
                return (
                  <React.Fragment key={q.id}>
                    <QuoteListCard
                      quote={q}
                      isSelected={selectedQuoteId === q.id}
                      onSelect={() => onSelectQuote(q)}
                      hasOlderVersions={older.length > 0}
                      isVersionExpanded={isExpanded}
                      onVersionToggle={(e) => toggleVersionExpand(q.id, e)}
                    />
                    {isExpanded && older.map((sq) => (
                      <SupersededVersionRow key={sq.id} quote={sq} />
                    ))}
                  </React.Fragment>
                );
              })
            )
          ) : standaloneSorted.length === 0 ? (
            <div className={cn('text-center p-4', colors.text.muted)}>
              <p>{t('list.emptyTitle')}</p>
              <p className="text-sm mt-1">{t('list.emptyDescription')}</p>
            </div>
          ) : (
            standaloneSorted.map((entry, index) => (
              <React.Fragment key={entry.q.id}>
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
                  onSelect={() => handleStandaloneSelect(entry.q)}
                />
              </React.Fragment>
            ))
          )}
        </div>
        )}
      </ScrollArea>
    </EntityListColumn>
  );
}
