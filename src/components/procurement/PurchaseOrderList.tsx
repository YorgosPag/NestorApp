'use client';

/**
 * PurchaseOrderList — PO list panel mirroring Contacts SSoT pattern.
 *
 * Composition: GenericListHeader + CompactToolbar + POStatusQuickFilters + ScrollArea[PurchaseOrderListCard].
 * Selected state styling and chip behavior identical to /contacts.
 *
 * "Requires Action" POs are pinned at the top of the same scrollable list with a section divider.
 *
 * @see ADR-267 §8.3 (PO List View)
 * @see ContactsList.tsx for reference implementation
 */

import React, { useMemo, useState } from 'react';
import { Package } from 'lucide-react';

import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';

import { GenericListHeader } from '@/components/shared/GenericListHeader';
import { CompactToolbar, procurementConfig } from '@/components/core/CompactToolbar';
import { POStatusQuickFilters } from '@/components/shared/TypeQuickFilters';
import { PurchaseOrderListCard } from '@/domain';
import { EntityListColumn } from '@/core/containers';

import type { PurchaseOrder, PurchaseOrderStatus } from '@/types/procurement';
import { useSortState } from '@/hooks/useSortState';
import { matchesSearchTerm } from '@/lib/search/search';

import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { cn } from '@/lib/utils';

// ============================================================================
// PROPS
// ============================================================================

interface PurchaseOrderListProps {
  purchaseOrders: PurchaseOrder[];
  actionRequired: PurchaseOrder[];
  loading: boolean;
  onCreateNew: () => void;
  onViewPO: (poId: string) => void;
  onDuplicate: (poId: string) => void;
  /** Split-panel mode: select inline instead of navigating */
  onSelectPO?: (po: PurchaseOrder) => void;
  /** Selected PO id — drives card highlight (split-panel) */
  selectedPOId?: string;
  /** Edit currently selected PO (split-panel: opens form) */
  onEditPO?: (poId: string) => void;
  /** Delete currently selected POs */
  onDeletePOs?: (poIds: string[]) => void;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function PurchaseOrderList({
  purchaseOrders,
  actionRequired,
  loading,
  onCreateNew,
  onViewPO,
  onDuplicate: _onDuplicate,
  onSelectPO,
  selectedPOId,
  onEditPO,
  onDeletePOs,
}: PurchaseOrderListProps) {
  const { t } = useTranslation(['procurement', 'common']);
  const colors = useSemanticColors();

  // Sort state via centralized hook
  const { sortBy, sortOrder, onSortChange } = useSortState<'date' | 'number' | 'status' | 'value'>('date');

  // CompactToolbar local state (mirrors ContactsList)
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilters, setActiveFilters] = useState<string[]>([]);
  const [showToolbar, setShowToolbar] = useState(false);

  // Quick-filter chips state — single-select mirroring ContactTypeQuickFilters
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);

  // Filter pipeline: status chips → search (poNumber + supplierId raw) → sort.
  // Supplier-name lookup happens per-card via useContactById (cards render their own name);
  // batch directory hook would be a separate optimization.
  const filtered = useMemo(() => {
    const actionRequiredIds = new Set(actionRequired.map((po) => po.id));

    return purchaseOrders.filter((po) => {
      if (selectedStatuses.length > 0 && !selectedStatuses.includes(po.status as PurchaseOrderStatus)) {
        return false;
      }
      if (searchTerm) {
        return matchesSearchTerm(
          [po.poNumber, po.supplierId, po.id],
          searchTerm,
        );
      }
      return true;
    }).map((po) => ({ po, isActionRequired: actionRequiredIds.has(po.id) }));
  }, [purchaseOrders, actionRequired, selectedStatuses, searchTerm]);

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
          return a.po.poNumber.localeCompare(b.po.poNumber) * dir;
        case 'status':
          return a.po.status.localeCompare(b.po.status) * dir;
        case 'value':
          return (a.po.total - b.po.total) * dir;
        case 'date':
        default:
          return a.po.dateCreated.localeCompare(b.po.dateCreated) * dir;
      }
    });
    return arr;
  }, [filtered, sortBy, sortOrder]);

  const firstNonAction = sorted.findIndex((entry) => !entry.isActionRequired);
  const actionRequiredVisible = sorted.filter((e) => e.isActionRequired).length;

  // Action handlers — wire toolbar to parent callbacks; mirror ContactsList semantics
  const handleNewItem = () => onCreateNew();
  const handleEditItem = (_id: string) => {
    if (selectedPOId && onEditPO) onEditPO(selectedPOId);
  };
  const handleDeleteItems = (_ids: string[]) => {
    if (selectedPOId && onDeletePOs) onDeletePOs([selectedPOId]);
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
          icon={Package}
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
            config={procurementConfig}
            selectedItems={selectedItems}
            onSelectionChange={setSelectedItems}
            searchTerm={searchTerm}
            onSearchChange={setSearchTerm}
            activeFilters={activeFilters}
            onFiltersChange={setActiveFilters}
            sortBy={sortBy}
            onSortChange={renderSortChange}
            hasSelectedContact={!!selectedPOId}
            onNewItem={handleNewItem}
            onEditItem={handleEditItem}
            onDeleteItems={handleDeleteItems}
          />
        </div>

        {/* Mobile: toggle */}
        <div className="md:hidden">
          {showToolbar && (
            <CompactToolbar
              config={procurementConfig}
              selectedItems={selectedItems}
              onSelectionChange={setSelectedItems}
              searchTerm={searchTerm}
              onSearchChange={setSearchTerm}
              activeFilters={activeFilters}
              onFiltersChange={setActiveFilters}
              sortBy={sortBy}
              onSortChange={renderSortChange}
              hasSelectedContact={!!selectedPOId}
              onNewItem={handleNewItem}
              onEditItem={handleEditItem}
              onDeleteItems={handleDeleteItems}
            />
          )}
        </div>
      </div>

      {/* Quick-filter chips — PO status */}
      <POStatusQuickFilters
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
              <React.Fragment key={entry.po.id}>
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
                      {t('list.allOrders')}
                    </span>
                  </div>
                )}
                <PurchaseOrderListCard
                  po={entry.po}
                  isSelected={selectedPOId === entry.po.id}
                  onSelect={() => (onSelectPO ? onSelectPO(entry.po) : onViewPO(entry.po.id))}
                />
              </React.Fragment>
            ))
          )}
        </div>
      </ScrollArea>
    </EntityListColumn>
  );
}
