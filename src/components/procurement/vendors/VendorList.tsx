'use client';

/**
 * VendorList — Vendor master list panel mirroring Contacts/POs SSoT pattern.
 *
 * Composition: GenericListHeader + CompactToolbar + VendorStatusQuickFilters
 * + ScrollArea[VendorListCard | VendorGridCard].
 *
 * @see ADR-267 §Phase J — Procurement SSoT alignment
 */

import React, { useMemo, useState } from 'react';
import { Users2 } from 'lucide-react';

import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';

import { GenericListHeader } from '@/components/shared/GenericListHeader';
import { CompactToolbar, vendorsConfig } from '@/components/core/CompactToolbar';
import { VendorStatusQuickFilters } from '@/components/shared/TypeQuickFilters';
import { VendorListCard, VendorGridCard, type VendorCardData } from '@/domain';
import { EntityListColumn } from '@/core/containers';

import { useSortState } from '@/hooks/useSortState';
import { matchesSearchTerm } from '@/lib/search/search';
import { getContactDisplayName } from '@/types/contacts';
import { makeVendorPredicate, type VendorFilter } from '@/subapps/procurement/utils/quick-filter-predicates';

import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { cn } from '@/lib/utils';

interface VendorListProps {
  vendors: VendorCardData[];
  loading: boolean;
  selectedVendorId: string | undefined;
  onSelectVendor: (data: VendorCardData) => void;
  viewMode?: 'list' | 'grid';
}

export function VendorList({
  vendors,
  loading,
  selectedVendorId,
  onSelectVendor,
  viewMode = 'list',
}: VendorListProps) {
  const { t } = useTranslation('procurement');
  const colors = useSemanticColors();

  const { sortBy, sortOrder, onSortChange } = useSortState<'name' | 'value' | 'date'>('name');
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilters, setActiveFilters] = useState<string[]>([]);
  const [showToolbar, setShowToolbar] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState<string[]>([]);

  const filtered = useMemo(() => {
    const filterValue = (selectedFilter[0] ?? '') as VendorFilter;
    const predicate = makeVendorPredicate(filterValue, vendors);

    return vendors.filter((v) => {
      if (!predicate(v)) return false;
      if (searchTerm) {
        const name = getContactDisplayName(v.contact);
        const specialties = v.metrics?.tradeSpecialties ?? [];
        return matchesSearchTerm([name, ...specialties, v.contact.id ?? ''], searchTerm);
      }
      return true;
    });
  }, [vendors, selectedFilter, searchTerm]);

  const sorted = useMemo(() => {
    const dir = sortOrder === 'asc' ? 1 : -1;
    return [...filtered].sort((a, b) => {
      switch (sortBy) {
        case 'value':
          return ((a.metrics?.totalSpend ?? 0) - (b.metrics?.totalSpend ?? 0)) * dir;
        case 'date': {
          const aTs = Date.parse(a.metrics?.lastOrderDate ?? '') || 0;
          const bTs = Date.parse(b.metrics?.lastOrderDate ?? '') || 0;
          return (aTs - bTs) * dir;
        }
        case 'name':
        default:
          return getContactDisplayName(a.contact).localeCompare(getContactDisplayName(b.contact)) * dir;
      }
    });
  }, [filtered, sortBy, sortOrder]);

  const renderSortChange = (newSortBy: string, newSortOrder: 'asc' | 'desc') => {
    if (newSortBy === 'name' || newSortBy === 'value' || newSortBy === 'date') {
      onSortChange(newSortBy, newSortOrder);
    }
  };

  const handleNewItem = () => {
    if (typeof window !== 'undefined') {
      window.location.href = '/contacts?type=supplier';
    }
  };

  return (
    <EntityListColumn hasBorder aria-label={t('hub.vendorMaster.title')}>
      <div>
        <GenericListHeader
          icon={Users2}
          entityName={t('hub.vendorMaster.title')}
          itemCount={sorted.length}
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          searchPlaceholder={t('hub.vendorMaster.searchPlaceholder')}
          showToolbar={showToolbar}
          onToolbarToggle={setShowToolbar}
          hideSearch
        />
        <div className="hidden md:block">
          <CompactToolbar
            config={vendorsConfig}
            selectedItems={selectedItems}
            onSelectionChange={setSelectedItems}
            searchTerm={searchTerm}
            onSearchChange={setSearchTerm}
            activeFilters={activeFilters}
            onFiltersChange={setActiveFilters}
            sortBy={sortBy}
            onSortChange={renderSortChange}
            hasSelectedContact={!!selectedVendorId}
            onNewItem={handleNewItem}
          />
        </div>
        <div className="md:hidden">
          {showToolbar && (
            <CompactToolbar
              config={vendorsConfig}
              selectedItems={selectedItems}
              onSelectionChange={setSelectedItems}
              searchTerm={searchTerm}
              onSearchChange={setSearchTerm}
              activeFilters={activeFilters}
              onFiltersChange={setActiveFilters}
              sortBy={sortBy}
              onSortChange={renderSortChange}
              hasSelectedContact={!!selectedVendorId}
              onNewItem={handleNewItem}
            />
          )}
        </div>
      </div>

      <VendorStatusQuickFilters
        selectedTypes={selectedFilter}
        onTypeChange={setSelectedFilter}
        compact
      />

      <ScrollArea className="flex-1">
        {loading ? (
          <div className="flex flex-col gap-2 p-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-14 rounded-md" />
            ))}
          </div>
        ) : sorted.length === 0 ? (
          <div className={cn('flex flex-col items-center gap-2 py-12 px-4 text-center', colors.text.muted)}>
            <Users2 className="h-8 w-8 opacity-40" aria-hidden />
            <p className="text-sm">
              {searchTerm || selectedFilter.length > 0
                ? t('hub.vendorMaster.emptySearch')
                : t('hub.vendorMaster.noVendorsYet')}
            </p>
          </div>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 p-3">
            {sorted.map((v) => (
              <VendorGridCard
                key={v.contact.id ?? ''}
                data={v}
                isSelected={v.contact.id === selectedVendorId}
                onSelect={() => onSelectVendor(v)}
              />
            ))}
          </div>
        ) : (
          <div className="p-2 space-y-2">
            {sorted.map((v) => (
              <VendorListCard
                key={v.contact.id ?? ''}
                data={v}
                isSelected={v.contact.id === selectedVendorId}
                onSelect={() => onSelectVendor(v)}
              />
            ))}
          </div>
        )}
      </ScrollArea>
    </EntityListColumn>
  );
}
