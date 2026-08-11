'use client';

/**
 * VendorList — Vendor master list panel mirroring Contacts/POs SSoT pattern.
 *
 * Composition: GenericListHeader + CompactToolbar + VendorStatusQuickFilters
 * + ScrollArea[VendorListCard | VendorGridCard].
 *
 * @see ADR-267 §Phase J — Procurement SSoT alignment
 */

import React, { useMemo } from 'react';
import { Users2 } from 'lucide-react';

import { ScrollArea } from '@/components/ui/scroll-area';

import { GenericListHeader } from '@/components/shared/GenericListHeader';
// ADR-784 §10.4 / CHECK 3.28 — ο SSoT της ζεύξης desktop/mobile ΥΠΗΡΧΕ ήδη· εδώ ήταν γραμμένη με το χέρι.
import { ResponsiveCompactToolbar, vendorsConfig } from '@/components/core/CompactToolbar';
import { VendorStatusQuickFilters } from '@/components/shared/TypeQuickFilters';
import { VendorListCard, VendorGridCard, type VendorCardData } from '@/domain';
import { EntityListColumn } from '@/core/containers';

// ADR-784 §10.4 / CHECK 3.28 — κατάσταση, ταξινόμηση και σώμα λίστας ζουν σε ΕΝΑ σημείο.
import { useSlimListState } from '../shared/use-slim-list-state';
import { useSortedRows } from '../shared/use-sorted-rows';
import { SlimListBody } from '../shared/SlimListBody';
import { matchesSearchTerm } from '@/lib/search/search';
import { getContactDisplayName } from '@/types/contacts';
import { makeVendorPredicate, type VendorFilter } from '@/subapps/procurement/utils/quick-filter-predicates';

import { useTranslation } from '@/i18n/hooks/useTranslation';

/** Το κλειστό λεξιλόγιο ταξινόμησης — δηλώνεται ΜΙΑ φορά και είναι ΚΑΙ ο φύλακας του toolbar. */
const VENDOR_SORT_KEYS = ['name', 'value', 'date'] as const;

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

  const {
    sortBy, sortOrder, onSortChange,
    selectedItems, setSelectedItems,
    searchTerm, setSearchTerm,
    activeFilters, setActiveFilters,
    showToolbar, setShowToolbar,
    selectedFilter, setSelectedFilter,
  } = useSlimListState(VENDOR_SORT_KEYS, 'name');

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

  const sorted = useSortedRows(filtered, sortBy, sortOrder, {
    name: (a, b) => getContactDisplayName(a.contact).localeCompare(getContactDisplayName(b.contact)),
    value: (a, b) => (a.metrics?.totalSpend ?? 0) - (b.metrics?.totalSpend ?? 0),
    date: (a, b) => (Date.parse(a.metrics?.lastOrderDate ?? '') || 0) - (Date.parse(b.metrics?.lastOrderDate ?? '') || 0),
  });


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
        <ResponsiveCompactToolbar
          showOnMobile={showToolbar}
          config={vendorsConfig}
          selectedItems={selectedItems}
          onSelectionChange={setSelectedItems}
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          activeFilters={activeFilters}
          onFiltersChange={setActiveFilters}
          sortBy={sortBy}
          onSortChange={onSortChange}
          hasSelectedContact={!!selectedVendorId}
          onNewItem={handleNewItem}
        />
      </div>

      <VendorStatusQuickFilters
        selectedTypes={selectedFilter}
        onTypeChange={setSelectedFilter}
        compact
      />

      <ScrollArea className="flex-1">
        <SlimListBody
          loading={loading}
          items={sorted}
          viewMode={viewMode}
          emptyIcon={Users2}
          emptyMessage={searchTerm || selectedFilter.length > 0
            ? t('hub.vendorMaster.emptySearch')
            : t('hub.vendorMaster.noVendorsYet')}
          keyOf={(v) => v.contact.id ?? ''}
          renderItem={(v, mode) => {
            const Card = mode === 'grid' ? VendorGridCard : VendorListCard;
            return (
              <Card
                data={v}
                isSelected={v.contact.id === selectedVendorId}
                onSelect={() => onSelectVendor(v)}
              />
            );
          }}
        />
      </ScrollArea>
    </EntityListColumn>
  );
}
